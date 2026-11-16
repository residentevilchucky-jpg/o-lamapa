(function () {
    'use strict';

    var PLUGIN_ID = 'stremio_webtor_cloud';
    var DEFAULT_ADDON = 'https://strem.fun';
    var FALLBACK_ADDON = 'https://strem.fun';
    var WEBTOR_SDK = 'https://jsdelivr.net';

    var sdkLoaded = false;

    // 1. Inicializa as configurações salvas no Lampa
    function initSettings() {
        Lampa.SettingsApi.addComponent({
            component: PLUGIN_ID,
            name: 'Cloud Grátis (Webtor)',
            icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM10 17l5-4-5-4v8z"/></svg>'
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_ID,
            param: {
                name: 'webtor_addon_url',
                type: 'input',
                values: '',
                default: DEFAULT_ADDON
            },
            field: {
                name: 'URL do Addon Stremio (manifest.json)',
                description: 'Cole o link do Torrentio, Brazuca ou outro addon compatível'
            }
        });

        Lampa.SettingsApi.addParam({
            component: PLUGIN_ID,
            param: {
                name: 'webtor_prioritize_ptbr',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Priorizar Dublado / PT-BR no topo',
                description: 'Destaca e move links em português para os primeiros lugares'
            }
        });
    }

    function getAddonUrl() {
        var saved = Lampa.Storage.get('webtor_addon_url', DEFAULT_ADDON);
        return (saved && saved.trim() !== '') ? saved.trim() : DEFAULT_ADDON;
    }

    // 2. Carrega o SDK do Webtor
    function carregarWebtorSDK(callback) {
        if (sdkLoaded || window.webtor) {
            sdkLoaded = true;
            if (callback) callback();
            return;
        }
        var script = document.createElement('script');
        script.src = WEBTOR_SDK;
        script.async = true;
        script.onload = function () {
            sdkLoaded = true;
            if (callback) callback();
        };
        script.onerror = function () {
            Lampa.Noty.show('Falha ao carregar motor do Webtor. Verifique sua internet.');
        };
        document.head.appendChild(script);
    }

    function startPlugin() {
        var network = new Lampa.Reguest();
        initSettings();
        carregarWebtorSDK();

        // 3. Adiciona o botão na tela de detalhes
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var render = e.object.activity.render();
                if (render.find('.view--online-free').length > 0) return;

                var btn = $('<div class="full-start__button selector view--online-free" style="background: linear-gradient(45deg, #1b5e20, #2e7d32); margin-left: 10px;">' +
                            '<span>Assistir Grátis (Cloud)</span>' +
                            '</div>');

                render.find('.full-start__buttons').append(btn);

                btn.on('hover:enter', function () {
                    prepararBusca(e.data.movie);
                });
            }
        });

        // 4. Obtém o IMDB ID e direciona para Filme ou Série
        function prepararBusca(movie) {
            var isSerie = Boolean(movie.first_air_date || movie.number_of_seasons);

            if (movie.imdb_id) {
                if (isSerie) selecionarTemporada(movie, movie.imdb_id);
                else buscarStreams(movie, movie.imdb_id, null, null, false);
            } else {
                Lampa.Loading.start();
                var tipoTmdb = isSerie ? 'tv' : 'movie';
                var urlExt = Lampa.TMDB.api(tipoTmdb + '/' + movie.id + '/external_ids?api_key=' + Lampa.TMDB.key());

                network.silent(urlExt, function (res) {
                    Lampa.Loading.stop();
                    if (res && res.imdb_id) {
                        movie.imdb_id = res.imdb_id;
                        if (isSerie) selecionarTemporada(movie, res.imdb_id);
                        else buscarStreams(movie, res.imdb_id, null, null, false);
                    } else {
                        Lampa.Noty.show('IMDB ID não encontrado para este título.');
                    }
                }, function () {
                    Lampa.Loading.stop();
                    Lampa.Noty.show('Erro ao buscar identificação do título.');
                });
            }
        }

        // 5. Seletor de Temporada
        function selecionarTemporada(movie, imdbId) {
            var seasons = (movie.seasons || []).filter(function (s) {
                return s.season_number > 0;
            });

            if (seasons.length === 0) {
                Lampa.Noty.show('Nenhuma temporada encontrada.');
                return;
            }

            var items = seasons.map(function (s) {
                return {
                    title: s.name || ('Temporada ' + s.season_number),
                    subtitle: s.episode_count + ' episódios',
                    season_number: s.season_number
                };
            });

            Lampa.Select.show({
                title: 'Escolha a Temporada',
                items: items,
                onSelect: function (item) {
                    selecionarEpisodio(movie, imdbId, item.season_number);
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        // 6. Seletor de Episódio
        function selecionarEpisodio(movie, imdbId, seasonNum) {
            Lampa.Loading.start();
            var urlEp = Lampa.TMDB.api('tv/' + movie.id + '/season/' + seasonNum + '?api_key=' + Lampa.TMDB.key() + '&language=pt-BR');

            network.silent(urlEp, function (res) {
                Lampa.Loading.stop();
                if (!res || !res.episodes || res.episodes.length === 0) {
                    Lampa.Noty.show('Episódios não encontrados.');
                    return;
                }

                var items = res.episodes.map(function (ep) {
                    return {
                        title: ep.episode_number + '. ' + (ep.name || 'Episódio ' + ep.episode_number),
                        subtitle: ep.air_date || '',
                        episode_number: ep.episode_number
                    };
                });

                Lampa.Select.show({
                    title: 'Temporada ' + seasonNum + ' - Episódio',
                    items: items,
                    onSelect: function (item) {
                        buscarStreams(movie, imdbId, seasonNum, item.episode_number, false);
                    },
                    onBack: function () {
                        selecionarTemporada(movie, imdbId);
                    }
                });
            }, function () {
                Lampa.Loading.stop();
                Lampa.Noty.show('Erro ao carregar lista de episódios.');
            });
        }

        // 7. Consulta o Addon com tentativa de Fallback automático
        function buscarStreams(movie, imdbId, season, episode, isFallback) {
            Lampa.Loading.start(function () {
                network.clear();
                Lampa.Loading.stop();
            });

            var tipo = season ? 'series' : 'movie';
            var queryId = season ? (imdbId + ':' + season + ':' + episode) : imdbId;
            var currentAddon = isFallback ? FALLBACK_ADDON : getAddonUrl();
            var baseUrl = currentAddon.replace('/manifest.json', '');
            var searchUrl = baseUrl + '/stream/' + tipo + '/' + queryId + '.json';

            network.silent(searchUrl, function (json) {
                Lampa.Loading.stop();

                if (json && json.streams && json.streams.length > 0) {
                    mostrarListaOpcoes(json.streams, movie, season, episode);
                } else if (!isFallback && currentAddon !== FALLBACK_ADDON) {
                    Lampa.Noty.show('Buscando em fonte alternativa...');
                    buscarStreams(movie, imdbId, season, episode, true);
                } else {
                    Lampa.Noty.show('Nenhuma fonte encontrada para este título.');
                }
            }, function () {
                Lampa.Loading.stop();
                if (!isFallback && currentAddon !== FALLBACK_ADDON) {
                    buscarStreams(movie, imdbId, season, episode, true);
                } else {
                    Lampa.Noty.show('Servidor de busca indisponível no momento.');
                }
            });
        }

        // 8. Ordena PT-BR no topo e exibe lista limpa na TV
        function mostrarListaOpcoes(streams, movie, season, episode) {
            var priorizarPt = Lampa.Storage.get('webtor_prioritize_ptbr', true);
            var regexPt = /(dublado|dual|pt-br|ptbr|portugues|nacional|legendado)/i;

            var processed = streams.filter(function (s) {
                return Boolean(s.infoHash);
            }).map(function (s) {
                var rawTitle = (s.title || s.name || '').replace(/\n/g, ' | ');
                var isPt = regexPt.test(rawTitle) || regexPt.test(s.name || '');
                return {
                    title: (isPt ? '[PT-BR] ' : '') + rawTitle,
                    subtitle: (s.name || 'Torrent') + (s.fileIdx !== undefined ? ' • Arquivo #' + s.fileIdx : ''),
                    isPt: isPt,
                    streamData: s
                };
            });

            if (priorizarPt) {
                processed.sort(function (a, b) {
                    return (b.isPt === a.isPt) ? 0 : b.isPt ? 1 : -1;
                });
            }

