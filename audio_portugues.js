(function () {
    'use strict';

    function iniciarFiltroPortugues() {
        if (window.plugin_audio_pt_ativo) return;
        window.plugin_audio_pt_ativo = true;

        // 1. Configura o Lampa para preferir áudio e interface em Português
        if (window.Lampa && Lampa.Storage) {
            Lampa.Storage.set('player_preferred_audio', 'por');
            Lampa.Storage.set('language', 'pt');
        }

        // 2. Adiciona um botão "Buscar Dublado (PT-BR)" na tela de detalhes de filmes e séries
        Lampa.Listener.follow('full', function (evento) {
            if (evento.type === 'complite') {
                var dadosFilme = evento.data.movie;
                var render = evento.object.activity.render();

                // Evita duplicar o botão
                if (render.find('.botao-dublado-pt').length > 0) return;

                var tituloOriginal = dadosFilme.original_title || dadosFilme.original_name || '';
                var tituloPT = dadosFilme.title || dadosFilme.name || '';
                var ano = (dadosFilme.release_date || dadosFilme.first_air_date || '').slice(0, 4);

                var botaoPT = $(
                    '<div class="full-start__button selector botao-dublado-pt" data-subtitle="Áudio PT-BR">' +
                        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>' +
                            '<path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>' +
                            '<line x1="12" y1="19" x2="12" y2="23"></line>' +
                            '<line x1="8" y1="23" x2="16" y2="23"></line>' +
                        '</svg>' +
                        '<span>Buscar Dublado</span>' +
                    '</div>'
                );

                // Ao clicar, abre a busca de torrents/fontes forçando termos em português
                botaoPT.on('hover:enter', function () {
                    var termoBusca = (tituloPT || tituloOriginal) + ' ' + ano + ' Dublado';
                    
                    Lampa.Noty.show('Buscando fontes dubladas para: ' + tituloPT);

                    Lampa.Activity.push({
                        url: '',
                        title: 'Fontes PT-BR: ' + tituloPT,
                        component: 'torrents',
                        search: termoBusca,
                        movie: dadosFilme,
                        page: 1
                    });
                });

                render.find('.full-start__buttons').append(botaoPT);
            }
        });

        // 3. Seleciona automaticamente a faixa de áudio em português quando o vídeo começa
        Lampa.Player.listener.follow('start', function () {
            setTimeout(function () {
                try {
                    var faixas = Lampa.PlayerVideo.getAudioTracks ? Lampa.PlayerVideo.getAudioTracks() : [];
                    for (var i = 0; i < faixas.length; i++) {
                        var lang = (faixas[i].language || faixas[i].label || '').toLowerCase();
                        if (lang.indexOf('por') !== -1 || lang.indexOf('pt') !== -1 || lang.indexOf('portug') !== -1 || lang.indexOf('bra') !== -1) {
                            Lampa.PlayerVideo.setAudioTrack(i);
                            Lampa.Noty.show('Áudio em Português ativado.');
                            break;
                        }
                    }
                } catch (erro) {
                    // Ignora caso o player nativo da TV gerencie o áudio externamente
                }
            }, 1500);
        });
    }

    if (window.appready) {
        iniciarFiltroPortugues();
    } else {
        Lampa.Listener.follow('app', function (evento) {
            if (evento.type === 'ready') {
                iniciarFiltroPortugues();
            }
        });
    }
})();
