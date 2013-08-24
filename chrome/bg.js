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
            var lskey = (key == 'keymap') ? 'keymap' : universe + '-' + key;
            r[key] = localStorage.getItem(lskey);
        }
        sendResponse(r);
        break;
    case 'save':
        var entries = request.entries;
        for(var key in entries) {
            var val = entries[key];
            var lskey = (key == 'keymap') ? 'keymap' : universe + '-' + key;
            if(val == null)
                localStorage.removeItem(lskey);
            else
                localStorage.setItem(lskey, val);
        }
        if(sendResponse)
            sendResponse(true);
    }
};

chrome.extension.onMessage.addListener(handler);
