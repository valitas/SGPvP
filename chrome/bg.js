// A message responder that manages the stored settings. We do this in
// a background page so settings are stored in the extension's
// localStorage, rather than that of the actual pardus pages.  This
// complicates things a bit but no way around it due to Chrome
// design...

function handler(request, sender, sendResponse) {
    var universe = request.universe;

    switch(request.op) {
    case 'load':
        var keys = request.keys, r = new Object();
        for(var i in keys) {
            var key = keys[i];
            r[key] = localStorage.getItem(universe + '-' + key);
            console.log('loaded ' + key, r[key]);
        }
        sendResponse(r);
        break;

    case 'save':
        console.log('save', request);
        var entries = request.entries;
        for(var key in entries) {
            var val = entries[key];
            if(val == null) {
                console.log('removing ' + universe + '-' + key);
                localStorage.removeItem(universe + '-' + key);
            }
            else {
                console.log('storing ' + universe + '-' + key, val);
                localStorage.setItem(universe + '-' + key, val);
            }
        }
        if(sendResponse)
            sendResponse(true);
    }

    return false;
};

chrome.extension.onMessage.addListener(handler);
