// SGPvP object. This code must run on Firefox and Google Chrome - no
// Greasemonkey calls and no chrome.* stuff here.

// V33

function SGPvP(top) {
    this.top = top;
    this.doc = top.document;
    this.doc.addEventListener('DOMContentLoaded',
                              this.onTopReady.bind(this), false);
}

SGPvP.prototype.onTopReady = function() {
    this.frames = {
        main: this.doc.getElementById('main'),
        menu: this.doc.getElementById('menu'),
        msgframe: this.doc.getElementById('msgframe')
    };
    if(!this.frames.main || !this.frames.menu || !this.frames.msgframe)
        throw new Error('SGPvP cannot find Pardus frames');
    this.platformInit();
};

SGPvP.prototype.onFrameReady = function(frame_id) {
    var frame = this.frames[frame_id];
    if(!frame)
        return;

    if(frame_id == 'main')
        this.mainDriver = new SGMain(frame.contentDocument);

    // We handle keys in all three Pardus frames.  In menu and
    // msgframe we don't really do anything, but we want to listen for
    // keys anyway because focus may switch to those, and we don't
    // want the user to have to click on the main frame.
    frame.contentDocument.addEventListener('keydown',
                                           this.onKeyDown.bind(this), false);
};

SGPvP.prototype.onKeyDown = function(event) {
    if(!this.mainDriver || event.ctrlKey || event.altKey || event.metaKey ||
       (event.target && (event.target.nodeName == 'INPUT' ||
                         event.target.nodeName == 'TEXTAREA')))
        return;

    if(this.mainDriver.keyPressHandler(event.keyCode)) {
        event.preventDefault();
        event.stopPropagation();
    }
};
