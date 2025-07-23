function initApp() {
    if ('FairPlay' === drmType) {
        loadCertificate();
    }
    else {
        // Install built-in polyfills to patch browser incompatibilities.
        shaka.polyfill.installAll();

        // Check to see if the browser supports the basic APIs Shaka needs.
        if (shaka.Player.isBrowserSupported()) {
            // Everything looks good!
            initPlayer();
        } else {
            // This browser does not have the minimum set of APIs we need.
            console.error('Browser not supported!');
        }
    }
}

function isAndroid() {
    return /Android/i.test(navigator.userAgent);
}




function initPlayer() {
    let contentUri, playerConfig;
    // Create a Player instance.
    const video = document.getElementById('my-player');
    let player = new shaka.Player(video);

    // Attach player to the window to make it easy to access in the JS console.
    window.player = player;

    // Listen for error events.
    player.addEventListener('error', onErrorEvent);

    if ('FairPlay' === drmType) {
        contentUri = hlsUri;
        const fairplayCert = getFairplayCert();

        playerConfig = {
            drm: {
                servers: {
                    'com.apple.fps.1_0': 'https://fps.ezdrm.com/api/licenses/fd537439-74e2-4aad-8adb-b9f3e6417c59'
                },
                advanced: {
                    'com.apple.fps.1_0': {
                        serverCertificate: fairplayCert
                    }
                },
                initDataTransform: function (initData) {
                    const skdUri = shaka.util.StringUtils.fromBytesAutoDetect(initData);
                    console.log('skdUri : ' + skdUri);
                    const contentId = skdUri.substring(skdUri.indexOf('skd://') + 6);
                    console.log('contentId : ', contentId);
                    const cert = player.drmInfo().serverCertificate;
                    return shaka.util.FairPlayUtils.initDataTransform(initData, contentId, cert);
                }
            }
        };

        player.getNetworkingEngine().registerRequestFilter(function (type, request) {
            if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
                const originalPayload = new Uint8Array(request.body);
                const base64Payload = shaka.util.Uint8ArrayUtils.toBase64(originalPayload);
                const params = 'spc=' + encodeURIComponent(base64Payload);

                request.body = shaka.util.StringUtils.toUTF8(params);
            }
        });

        player.getNetworkingEngine().registerResponseFilter(function (type, response) {
            // Alias some utilities provided by the library.
            if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
                const responseText = shaka.util.StringUtils.fromUTF8(response.data).trim();
                response.data = shaka.util.Uint8ArrayUtils.fromBase64(responseText).buffer;
                parsingResponse(response);
            }
        });
    } else {
        contentUri = dashUri;
        if ('Widevine' === drmType) {
            if (isAndroid()) {
                playerConfig = {
                    drm: {
                        servers: {
                            'com.widevine.alpha': 'https://widevine-dash.ezdrm.com/widevine-php/widevine-foreignkey.php?pX=DC4AED'
                        },
                        advanced: {
                            'com.widevine.alpha': {
                                'videoRobustness': 'HW_SECURE_ALL',
                                'audioRobustness': 'HW_SECURE_CRYPTO'
                            }
                        }
                    }
                };
            }
            else {
                playerConfig = {
                    drm: {
                        servers: {
                            'com.widevine.alpha': 'https://widevine-dash.ezdrm.com/widevine-php/widevine-foreignkey.php?pX=DC4AED'
                        }
                    }
                };
            }


            player.getNetworkingEngine().registerRequestFilter(function (type, request) {
                // Only add headers to license requests:
                if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
                    console.log("request :" + request.body);
                }
            });
        } else {
            console.log("init player ready");
            playerConfig = {
                drm: {
                    servers: {
                        'com.microsoft.playready': 'https://playready.ezdrm.com/cency/preauth.aspx?pX=EF8C1A'
                    }
                }
            };

            console.log("starting player ready");
            player.getNetworkingEngine().registerRequestFilter(function (type, request) {
                // Only add headers to license requests:
                if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
                    console.log("request :" + request.body);
                }
            });

        };

        player.getNetworkingEngine().registerResponseFilter(function (type, response) {
            // Alias some utilities provided by the library.
            if (type == shaka.net.NetworkingEngine.RequestType.LICENSE) {
                parsingResponse(response);
            }
        });
    }

    // Try to load a manifest.
    // This is an asynchronous process.
    console.log("loading data");
    player.load(contentUri).then(function () {
        // This runs if the asynchronous load is successful.
        console.log('The video has now been loaded!');
    }).catch(onError); // onError is executed if the asynchronous load fails.

    console.log("configuring data");
    player.configure(playerConfig);

}

function parsingResponse(response) {
    let responseText = arrayBufferToString(response.data);
    // Trim whitespace.
    responseText = responseText.trim();

    console.log('responseText :: ', responseText);

    try {
        const drmconObj = JSON.parse(responseText);
        if (drmconObj && drmconObj.errorCode && drmconObj.message) {
            if ("8002" != errorCode) {
                alert("DRM Error : " + drmconObj.message + "(" + drmconObj.errorCode + ")");
                //window.alert('No Rights. Server Response ' + responseText);
            } else {
                var errorObj = JSON.parse(drmconObj.message);
                alert("Error : " + errorObj.MESSAGE + "(" + errorObj.ERROR + ")");
            }
        }
    } catch (e) { }
}

function onErrorEvent(event) {
    // Extract the shaka.util.Error object from the event.
    console.error('Error code', event.detail.code, 'object', event.detail);
    onError(event.detail);
}

function onError(error) {
    // Log the error.
    console.error('Error code', error.code, 'object', error);
}

checkBrowser();
document.addEventListener('DOMContentLoaded', initApp);


/*
    The EME specification (https://dvcs.w3.org/hg/html-media/raw-file/tip/encrypted-media/encrypted-media.html)
    is supported starting OSX 10.10 and greater.
*/
var keySystem;
var certificate;

// ########### --------------------------------------- ###########
// ------------------------PATHS TO ADJUST------------------------
// ---------------------------------------------------------------

var serverCertificatePath = 'https://fps.ezdrm.com/demo/video/eleisure.cer'; // ADAPT: This is the path to the fps certificate on your server.
var serverProcessSPCPath = 'https://fps.ezdrm.com/api/licenses/b99ed9e5-c641-49d1-bfa8-43692b686ddb';     // ADAPT: This is the path/URL to the keyserver module that processes the SPC and returns a CKC
var serverMediaSourcePath = 'https://na-fps.ezdrm.com/demo/ezdrm/master.m3u8';

function stringToArray(string) {
    var buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char
    var array = new Uint16Array(buffer);
    for (var i = 0, strLen = string.length; i < strLen; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array;
}

function arrayToString(array) {
    var uint16array = new Uint16Array(array.buffer);
    return String.fromCharCode.apply(null, uint16array);
}

function waitForEvent(name, action, target) {
    target.addEventListener(name, function () {
        action(arguments[0]);
    }, false);
}

function loadCertificate() {
    var request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.addEventListener('load', onCertificateLoaded, false);
    request.addEventListener('error', onCertificateError, false);
    request.open('GET', serverCertificatePath, true);
    // request.setRequestHeader('Pragma', 'Cache-Control: no-cache');
    // request.setRequestHeader("Cache-Control", "max-age=0");
    request.send();
}

function onCertificateLoaded(event) {
    var request = event.target;
    certificate = new Uint8Array(request.response);
    startVideo();
}

function onCertificateError(event) {
    window.console.error('Failed to retrieve the server certificate.')
}

function extractContentId(initData) {
    var uri = arrayToString(initData);
    var uriParts = uri.split('://', 1);
    var protocol = uriParts[0].slice(-3);

    uriParts = uri.split(';', 2);
    var contentId = uriParts.length > 1 ? uriParts[1] : '';

    return protocol.toLowerCase() == 'skd' ? contentId : '';
}

function concatInitDataIdAndCertificate(initData, id, cert) {
    if (typeof id == "string")
        id = stringToArray(id);
    // layout is [initData][4 byte: idLength][idLength byte: id][4 byte:certLength][certLength byte: cert]
    var offset = 0;
    var buffer = new ArrayBuffer(initData.byteLength + 4 + id.byteLength + 4 + cert.byteLength);
    var dataView = new DataView(buffer);

    var initDataArray = new Uint8Array(buffer, offset, initData.byteLength);
    initDataArray.set(initData);
    offset += initData.byteLength;

    dataView.setUint32(offset, id.byteLength, true);
    offset += 4;

    var idArray = new Uint16Array(buffer, offset, id.length);
    idArray.set(id);
    offset += idArray.byteLength;

    dataView.setUint32(offset, cert.byteLength, true);
    offset += 4;

    var certArray = new Uint8Array(buffer, offset, cert.byteLength);
    certArray.set(cert);

    return new Uint8Array(buffer, 0, buffer.byteLength);
}

function selectKeySystem() {
    if (WebKitMediaKeys.isTypeSupported("com.apple.fps.1_0", "video/mp4")) {
        keySystem = "com.apple.fps.1_0";
    }
    else {
        throw "Key System not supported";
    }
}

function startVideo() {
    var video = document.getElementsByTagName('video')[0];
    video.addEventListener('webkitneedkey', onneedkey, false);
    video.addEventListener('error', onerror, false);

    // ADAPT: there must be logic here to fetch/build the appropriate m3u8 URL
    video.src = serverMediaSourcePath;
}

function onerror(event) {
    window.console.error('A video playback error occurred')
}

function onneedkey(event) {
    var video = event.target;
    var initData = event.initData;
    var contentId = extractContentId(initData);

    initData = concatInitDataIdAndCertificate(initData, contentId, certificate);

    if (!video.webkitKeys) {
        selectKeySystem();
        video.webkitSetMediaKeys(new WebKitMediaKeys(keySystem));
    }

    if (!video.webkitKeys)
        throw "Could not create MediaKeys";

    var keySession = video.webkitKeys.createSession("video/mp4", initData);
    if (!keySession)
        throw "Could not create key session";

    keySession.contentId = contentId;
    waitForEvent('webkitkeymessage', licenseRequestReady, keySession);
    waitForEvent('webkitkeyadded', onkeyadded, keySession);
    waitForEvent('webkitkeyerror', onkeyerror, keySession);
}

function licenseRequestReady(event) {
    var session = event.target;
    var message = event.message;
    var sessionId = session.sessionId;
    var blob = new Blob([message], { type: 'application/octet-binary' });
    var request = new XMLHttpRequest();
    request.session = session;
    request.open('POST', serverProcessSPCPath + '?p1=' + Date.now(), true);
    request.setRequestHeader('Content-type', 'application/octet-stream');
    request.responseType = 'blob';
    request.addEventListener('load', licenseRequestLoaded, false);

    request.send(blob);
}

function licenseRequestLoaded(event) {
    var request = event.target;
    if (request.status == 200) {
        var blob = request.response;

        var reader = new FileReader();
        reader.addEventListener('loadend', function () {
            var array = new Uint8Array(reader.result);
            request.session.update(array);
        });
        reader.readAsArrayBuffer(blob);
    }
}

function licenseRequestFailed(event) {
    window.console.error('The license request failed.');
}

function onkeyerror(event) {
    window.console.error('A decryption key error was encountered');
}

function onkeyadded(event) {
    window.console.log('Decryption key was added to session.');
}
