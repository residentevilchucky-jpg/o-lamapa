
/*
 * Lampa PT-BR v1.0.0
 * Samsung 2015 / Media Station X
 * Identificação de áudio e legendas brasileiras.
 */

(function () {
    'use strict';

    if (window.__lampa_ptbr_loaded) return;
    window.__lampa_ptbr_loaded = true;

    var VERSION = '1.0.0';

    function normalize(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[áàãâä]/g, 'a')
            .replace(/[éèêë]/g, 'e')
            .replace(/[íìîï]/g, 'i')
            .replace(/[óòõôö]/g, 'o')
            .replace(/[úùûü]/g, 'u')
            .replace(/ç/g, 'c')
            .replace(/[_]+/g, '-')
            .trim();
    }

    function isPortugal(value) {
        var s = normalize(value);
        return /portugal|pt-pt|por-pt|pt_pt|por_pt|portugues \(portugal\)/.test(s);
    }

    function isBrazilianPortuguese(value) {
        var s = normalize(value);

        if (!s || isPortugal(s)) return false;

        if (/pt-br|ptbr|por-br|porbr|pob|brazilian portuguese|portugues brasileiro/.test(s)) {
            return true;
        }

        if (/portugues|portuguese/.test(s)) return true;

        if (/^(pt|por)$/.test(s)) return true;

        return false;
    }

    function trackName(track) {
        if (!track) return '';

        return [
            track.language,
            track.lang,
            track.label,
            track.name,
            track.title
        ].filter(Boolean).join(' ');
    }

    function getVideo() {
        try {
            if (window.Lampa &&
                Lampa.PlayerVideo &&
                typeof Lampa.PlayerVideo.video === 'function') {
                return Lampa.PlayerVideo.video();
            }
        } catch (e) {}

        return null;
    }

    function selectAudio(video) {
        if (!video || !video.audioTracks) return false;

        var tracks = video.audioTracks;
        var selected = -1;

        // Prioridade máxima: PT-BR explícito.
        for (var i = 0; i < tracks.length; i++) {
            var name = normalize(trackName(tracks[i]));

            if (!isPortugal(name) &&
                /pt-br|ptbr|por-br|porbr|pob|brazilian portuguese|portugues brasileiro/.test(name)) {
                selected = i;
                break;
            }
        }

        // Segunda prioridade: Português genérico.
        if (selected < 0) {
            for (var j = 0; j < tracks.length; j++) {
                if (isBrazilianPortuguese(trackName(tracks[j]))) {
                    selected = j;
                    break;
                }
            }
        }

        if (selected < 0) return false;

        try {
            for (var k = 0; k < tracks.length; k++) {
                tracks[k].enabled = (k === selected);
            }

            console.log('[Lampa PT-BR] Áudio selecionado:', trackName(tracks[selected]));
            return true;
        } catch (e) {
            console.log('[Lampa PT-BR] Erro ao selecionar áudio:', e);
            return false;
        }
    }

    function selectSubtitle(video, audioFound) {
        if (!video || !video.textTracks) return false;

        if (audioFound) {
            try {
                for (var x = 0; x < video.textTracks.length; x++) {
                    video.textTracks[x].mode = 'disabled';
                }
            } catch (e) {}

            return false;
        }

        var tracks = video.textTracks;
        var selected = -1;

        for (var i = 0; i < tracks.length; i++) {
            var name = normalize(trackName(tracks[i]));

            if (!isPortugal(name) &&
                /pt-br|ptbr|por-br|porbr|pob|brazilian portuguese|portugues brasileiro/.test(name)) {
                selected = i;
                break;
            }
        }

        if (selected < 0) {
            for (var j = 0; j < tracks.length; j++) {
                if (isBrazilianPortuguese(trackName(tracks[j]))) {
                    selected = j;
                    break;
                }
            }
        }

        if (selected < 0) return false;

        try {
            for (var k = 0; k < tracks.length; k++) {
                tracks[k].mode = (k === selected) ? 'showing' : 'disabled';
            }

            console.log('[Lampa PT-BR] Legenda selecionada:', trackName(tracks[selected]));
            return true;
        } catch (e) {
            console.log('[Lampa PT-BR] Erro ao selecionar legenda:', e);
            return false;
        }
    }

    function scanPlayer() {
        var video = getVideo();

        if (!video) return;

        var audioFound = selectAudio(video);
        selectSubtitle(video, audioFound);
    }

    window.LampaPTBR = {
        version: VERSION,

        isBrazilianPortuguese: isBrazilianPortuguese,

        isPortugal: isPortugal,

        scanPlayer: scanPlayer,

        classify: function (item) {
            var text = [
                item.audio,
                item.audio_lang,
                item.audio_language,
                item.language,
                item.lang,
                item.label,
                item.name,
                item.subtitles
            ].filter(Boolean).join(' ');

            if (isPortugal(text)) {
                return {
                    ptbr: false,
                    label: 'Português (Portugal)'
                };
            }

            if (isBrazilianPortuguese(text)) {
                return {
                    ptbr: true,
                    label: 'PT-BR'
                };
            }

            return {
                ptbr: false,
                label: 'Idioma não confirmado'
            };
        }
    };

    function initialize() {
        if (!window.Lampa) return;

        try {
            if (Lampa.Player && Lampa.Player.listener) {
                Lampa.Player.listener.follow('start', function () {
                    setTimeout(scanPlayer, 300);
                    setTimeout(scanPlayer, 1000);
                    setTimeout(scanPlayer, 2200);
                });
            }

            console.log('[Lampa PT-BR] Plugin v' + VERSION + ' carregado!');
        } catch (e) {
            console.log('[Lampa PT-BR] Erro:', e);
        }
    }

    if (window.appready) {
        initialize();
    } else if (window.Lampa &&
               Lampa.Listener &&
               Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (event) {
            if (event && event.type === 'ready') {
                initialize();
            }
        });
    } else {
        var attempts = 0;

        var timer = setInterval(function () {
            attempts++;

            if (window.Lampa && window.appready) {
                clearInterval(timer);
                initialize();
            }

            if (attempts > 40) {
                clearInterval(timer);
            }
        }, 500);
    }

})();
