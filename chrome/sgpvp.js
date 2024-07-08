class SGPvP {
    #keyDownHandler;
    #mainDriver;

    static get singleton() {
        let instance = top.SGPvP;
        if (instance === undefined) {
            instance = new SGPvP();
            top.SGPvP = instance;
        }
        return instance;
    }

    constructor() {
        this.#keyDownHandler = this.#onKeyDown.bind(this);
    }

    registerCurrentFrame(document) {
        let frameElement = document.defaultView.frameElement;
        if (frameElement !== null && frameElement.id === 'main') {
            this.#mainDriver = new SGMain(document);
        }

        // This actually installs a handler on the frameset document.  Is that a
        // problem?
        document.addEventListener('keydown', this.#keyDownHandler);
    }

    #onKeyDown(event) {
        if (!this.#mainDriver || event.ctrlKey || event.altKey || event.metaKey)
            return;
        if (event.target) {
            var name = event.target.nodeName;
            if (name == 'INPUT' || name == 'SELECT' || name == 'TEXTAREA')
                return;
        }
        if (this.#mainDriver.keyPressHandler(event.keyCode)) {
            event.preventDefault();
            event.stopPropagation();
        }
    }
}
