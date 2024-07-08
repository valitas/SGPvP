(function() {
    var fn = function() {
        let msg = {
            sgpvp: 1,
            loc: typeof(userloc) === 'undefined' ? null : userloc,
            ajax: typeof(ajax) === 'undefined' ? null : ajax
        };
        window.postMessage(
            msg,
            `${window.location.protocol}//${window.location.host}`
        );
    };
    if(typeof(addUserFunction)=='function') {
        addUserFunction(fn);
    }
    fn();
})();
