(function () {
    'use strict';

    var CONFIG = {
        addonUrl: 'https://strem.fun',
        webtorSdkUrl: 'https://jsdelivr.net'
    };

    var sdkLoaded = false;

    // Carrega o SDK do Webtor apenas uma vez em segundo plano
    function carregarWebtorSDK(callback) {
        if (sdkLoaded || window.webtor) {
            sdkLoaded = true;
            if (callback) callback();
            return;
        }
        var script = document.createElement('script');
        script.src = CONFIG.webtorSdkUrl;
        script.async = true;
        script.onload = function () {
            sdkLoaded = true;
            if (callback) callback();
        };
        document.head.appendChild(script);
    }

    function startPlugin() {
        var network = new Lampa.Reguest();
        carregarWebtorSDK();

        // 1. Adiciona o botão na tela de detalhes do filme ou série
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var render = e.object.activity.render();
                
                // Evita duplicar o botão se a tela recarregar
                if (render.find('.view--online-free').length > 0) return;

                var btn = $('<div class="full-start__button selector view--online-free" style="background: #2e7d32; margin-left: 10px;">' +
                            '<span>Assistir Grátis (Cloud)</span>' +
                            '</div>');

                render.find('.full-start__buttons').append(btn);

                btn.on('hover:enter', function () {
                    prepararBusca(e.data.movie);
                });
            }
        });

        // 2. Verifica se é filme ou série e garante que temos o IMDB ID
        function prepararBusca(movie) {
            var isSerie = Boolean(movie.first_air_date || movie.number_of_seasons);

            if (movie.imdb_id) {
                if (isSerie) {
                    selecionarTemporada(movie, movie.imdb_id);
                } else {
                    buscarStreams(movie, movie.imdb_id, null, null);
                }
            } else {
                Lampa.Loading.start();
                var tipoTmdb = isSerie ? 'tv' : 'movie';
                var urlExt = Lampa.TMDB.api(tipoTmdb + '/' + movie.id + '/external_ids?api_key=' + Lampa.TMDB.key());

                network.silent(urlExt, function (res) {
                    Lampa.Loading.stop();
                    if (res && res.imdb_id) {
                        movie.imdb_id = res.imdb_id;
                        if (isSerie) {
                            selecionarTemporada(movie, res.imdb_id);
                        } else {
                            buscarStreams(movie, res.imdb_id, null, null);
                        }
                    } else {
                        Lampa.Noty.show('IMDB ID não encontrado para este título.');
                    }
                }, function () {
                    Lampa.Loading.stop();
                    Lampa.Noty.show('Erro ao buscar identificação do título.');
                });
            }
        }

        // 3. Menu de Temporadas para Séries
        function selecionarTemporada(movie, imdbId) {
            var seasons = (movie.seasons || []).filter(function (s) {
                return s.season_number > 0;
            });

            if (seasons.length === 0) {
                Lampa.Noty.show('Nenhuma temporada disponível.');
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

        // 4. Menu de Episódios para Séries
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
                        buscarStreams(movie, imdbId, seasonNum, item.episode_number);
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

        // 5. Consulta o Addon do Stremio (Filme ou Série:Temporada:Episódio)
        function buscarStreams(movie, imdbId, season, episode) {
            Lampa.Loading.start(function () {
                network.clear();
                Lampa.Loading.stop();
            });

            var tipo = season ? 'series' : 'movie';
            var queryId = season ? (imdbId + ':' + season + ':' + episode) : imdbId;
            var baseUrl = CONFIG.addonUrl.replace('/manifest.json', '');
            var searchUrl = baseUrl + '/stream/' + tipo + '/' + queryId + '.json';

            network.silent(searchUrl, function (json) {
                Lampa.Loading.stop();

                if (json && json.streams && json.streams.length > 0) {
                    mostrarListaOpcoes(json.streams, movie, season, episode);
                } else {
                    Lampa.Noty.show('Nenhuma fonte encontrada para esta seleção.');
                }
            }, function () {
                Lampa.Loading.stop();
                Lampa.Noty.show('Erro ao conectar com o servidor de busca.');
            });
        }

        // 6. Lista os torrents encontrados para escolha do usuário
        function mostrarListaOpcoes(streams, movie, season, episode) {
            var items = streams.map(function (s) {
                return {
                    title: s.title || s.name || 'Fonte Torrent',
                    subtitle: s.name || 'Webtor Cloud',
                    streamData: s
                };
            });

            Lampa.Select.show({
                title: 'Escolha a qualidade / áudio',
                items: items,
                onSelect: function (item) {
                    abrirPlayerWebtor(item.streamData, movie, season, episode);
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        }

        // 7. Abre o Player Embutido do Webtor em tela cheia
        function abrirPlayerWebtor(stream, movie, season, episode) {
            if (!stream.infoHash) {
                Lampa.Noty.show('Link magnético inválido.');
                return;
            }

            var magnet = 'magnet:?xt=urn:btih:' + stream.infoHash;
            var tituloExibicao = (movie.title || movie.name) + (season ? (' - T' + season + 'E' + episode) : '');

            // Cria uma camada em tela cheia por cima do Lampa
            var overlay = $('<div id="webtor-overlay" style="position:fixed; top:0; left:0; width:100%; height:100%; background:#000; z-index:99999; display:flex; flex-direction:column;">' +
                            '<div style="padding:12px 20px; background:#111; color:#fff; display:flex; justify-content:space-between; align-items:center; font-size:18px;">' +
                            '<span>' + tituloExibicao + '</span>' +
                            '<span style="font-size:14px; color:#aaa;">Pressione VOLTAR no controle para sair</span>' +
                            '</div>' +
                            '<div id="webtor-player-box" style="flex:1; width:100%; height:100%;"></div>' +
                            '</div>');

            $('body').append(overlay);

            // Registra o botão "Voltar" do controle remoto da TV para fechar o vídeo
            Lampa.Controller.add('webtor_player', {
                toggle: function () {},
                back: function () {
                    $('#webtor-overlay').remove();
                    Lampa.Controller.toggle('content');
                }
            });
            Lampa.Controller.toggle('webtor_player');

            // Inicializa o vídeo dentro do contêiner
            carregarWebtorSDK(function () {
                window.webtor = window.webtor || [];
                window.webtor.push({
                    id: 'webtor-player-box',
                    magnet: magnet,
                    width: '100%',
                    height: '100%',
                    lang: 'pt',
                    i18n: {
                        en: {
                            common: {
                                "prepare to play": "Carregando vídeo na nuvem...",
                            }
                        }
