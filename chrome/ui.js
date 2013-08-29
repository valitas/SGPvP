// SGPvP object - user interface methods.
// 
// This code is not loaded unless the user interface has to be shown,
// to keep things fast.
// 
// This code must run in Firefox and Google Chrome - no Greasemonkey
// calls and no chrome.* APIs here.  localStorage should not be
// accessed from here either.

// V 31.7

function SGPvPUI(sgpvp, doc) {
    this.sgpvp = sgpvp;
    this.doc = doc;
}

SGPvPUI.prototype.injectStyle = function() {
    var doc = this.doc;

    if(doc.getElementById('sg-style'))
        return;

    var head = doc.evaluate('/html/head', doc, null,
                                 XPathResult.ANY_UNORDERED_NODE_TYPE,
                                 null).singleNodeValue;
    var link = doc.createElement('link');
    link.id = 'sg-style';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = this.sgpvp.getResourceURL('ui_style');
    head.appendChild(link);
};

SGPvPUI.prototype.open = function() {
    if(this.ui_element)
        return;

    this.injectStyle();

    var doc = this.doc;
    var dummy = doc.createElement('div');
    dummy.innerHTML = this.sgpvp.getResourceText('ui_html');
    var div = dummy.removeChild(dummy.firstChild);
    doc.body.appendChild(div);
    this.setUIElement(div);
};

SGPvPUI.prototype.close = function() {
    if(this.ui_element) {
        this.ui_element.parentNode.removeChild(this.ui_element);
        delete this.ui_element;
    }
};

SGPvPUI.prototype.enableClose = function(enabled) {
    var close = this.elements.close;
    if(enabled) {
        close.disabled = false;
        close.style.borderColor = null;
        close.style.color = null;
    }
    else {
        close.disabled = true;
        close.style.borderColor = 'rgb(0,0,28)';
        close.style.color = 'rgb(56,56,84)';
    }
};

SGPvPUI.prototype.enableCloseIfProper = function() {
    var enabled = this.targetingValid && this.armourValid && this.rtidValid;
    this.enableClose(enabled);
};

// Parse QL and include/exclude lists. Store if they are valid,
// inhibit close if they are not.
SGPvPUI.prototype.targetingDataInputHandler = function() {
    this.targetingValid = false;

    var qo = this.parseQL(this.elements.ql.value);
    if(qo) {
        this.targetingValid = true;
        this.elements.ql.style.removeProperty('color');
        var settings = {
            ql: qo.ql,
            targeting: {
                ql: qo.parsed,
                include: this.parseOverrideList(this.elements.inc.value),
                exclude: this.parseOverrideList(this.elements.exc.value)
            }
        };
        this.sgpvp.saveSettings(settings);
    }
    else
        this.elements.ql.style.color = 'red';
    this.enableCloseIfProper();
};

SGPvPUI.prototype.DIGITS_RX = /^\s*[0-9]+\s*$/;
SGPvPUI.prototype.EMPTY_RX = /^\s*$/;

// Gets the value of the given element. If it's a positive integer,
// return it. If it isn't, turn the element red and return null. If
// max is supplied, then value also must be <= max.  If allowEmpty is
// true, then an empty string will return -1 and the element
// won't turn red.
SGPvPUI.prototype.getPositiveIntegerValue = function(element, max, allowEmpty) {
    var value = element.value;
    if(this.DIGITS_RX.test(value)) {
        var nvalue = parseInt(value);
        if(nvalue > 0 && (!max || nvalue <= max)) {
            element.style.color = null;
            return nvalue;
        }
    }
    else if(allowEmpty && this.EMPTY_RX.test(value)) {
        element.style.color = null;
        return -1;
    }

    // Still here? Problem.
    element.style.color = 'red';
    return null;
};

SGPvPUI.prototype.armourInputHandler = function() {
    var points = this.getPositiveIntegerValue(this.elements.arm),
    level = this.getPositiveIntegerValue(this.elements.lvl, 6);
    if(points && level) {
        this.armourValid = true;
        this.sgpvp.saveSettings({ armour: {points:points, level:level} });
    }
    else
        this.armourValid = false;
    this.enableCloseIfProper();
};

SGPvPUI.prototype.rtidInputHandler = function() {
    var rtid = this.getPositiveIntegerValue(this.elements.rid, null, true);
    if(rtid) {
        this.rtidValid = true;
        if(rtid > 0)
            this.sgpvp.saveSettings({ rtid: rtid });
        // else XXX - we should have a deleteSettings method...
    }
    else
        this.rtidValid = false;
    this.enableCloseIfProper();
};

SGPvPUI.prototype.rmslClickHandler = function() {
    var rmsl = this.elements.rmsl.checked ? 1 : 0;
    this.sgpvp.saveSettings({ rmsl: rmsl });
};

SGPvPUI.prototype.switchToPanel = function(panel) {
    var e = this.elements;
    switch(panel) {
    case 'targeting':
        e.s2targeting.className = 'active';
        e.s2keys.className = '';
        e.targeting.style.display = 'block';
        e.keybindings.style.display = 'none';
        e.setkey.style.display = 'none';
        this.enableCloseIfProper();
        break;
    case 'bindings':
        e.s2targeting.className = '';
        e.s2keys.className = 'active';
        e.targeting.style.display = 'none';
        e.keybindings.style.display = 'block';
        e.setkey.style.display = 'none';
        this.enableClose(true);
    }
};

SGPvPUI.prototype.switchToSetKey = function(keydiv) {
    var e = this.elements;
    this.setkey_div = keydiv;
    this.setkey_id = parseInt(keydiv.id.substr(4));
    var cap = keydiv.firstChild.textContent; // bit flaky but succinct
    var action = this.keymap[this.setkey_id];

    e.keybindings.style.display = 'none';
    e.setkey.style.display = 'block';
    e.setkey_code.textContent = this.setkey_id;
    e.setkey_key.textContent = cap;
    this.setSelectedAction(action);
    this.enableClose(false);
};

SGPvPUI.prototype.setSelectedAction = function(action) {
    if(!action)
        action = '';
    var e = this.elements, opts = e.setkey_select.options;
    for(var i = 0, end = opts.length; i < end; i++) {
        var opt = opts.item(i);
        if(action == opt.value) {
            e.setkey_select.selectedIndex = i;
            this.setKeyLegend(e.setkey_key, action);
            break;
        }
    }
};

SGPvPUI.prototype.setKeySelectChangeHandler = function() {
    var e = this.elements,
    opts = e.setkey_select.options,
    action = opts[e.setkey_select.selectedIndex].value;

    this.setKeyLegend(e.setkey_key, action);
    this.setKeyLegend(this.setkey_div, action);
    if(action)
        this.keymap[this.setkey_id] = action;
    else
        delete this.keymap[this.setkey_id];
    this.saveKeyMap();
};

SGPvPUI.prototype.setKeyLegend = function(key, action) {
    if(action) {
        var legend = this.actionNames[action];
        if(!legend)
            legend = action;

        var legenddiv = key.firstElementChild;
        if(!legenddiv) {
            legenddiv = key.ownerDocument.createElement('div');
            key.appendChild(legenddiv);
        }

        legenddiv.textContent = legend;
    }
    else {
        var legenddiv = key.firstElementChild;
        if(legenddiv)
            key.removeChild(legenddiv);
    }
};

SGPvPUI.prototype.resetKeyMap = function(resid) {
    var r = confirm('This will remove all custom key bindings you '
                    + 'may have defined. You OK with this?');
    if(r) {
        this.keymap = JSON.parse(sgpvp.getResourceText(resid));
        this.saveKeyMap();
        // XXX this code is almost duplicated below, reuse
        var e = this.elements;
        var xpr = this.doc.evaluate('div', e.keyboard, null,
                                    XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
                                    null);
        for(var i = 0, end = xpr.snapshotLength; i < end; i++) {
            var kdiv = xpr.snapshotItem(i);
            var code = parseInt(kdiv.id.substr(4));
            var action = this.keymap[code];
            this.setKeyLegend(kdiv, action);
        }
    }
};

// We use all these elements in the UI DOM.
SGPvPUI.prototype.UI_ELEMENT_IDS =
    [ 'sg-arm',
      'sg-close',
      'sg-default-keymap',
      'sg-exc',
      'sg-illarion-keymap',
      'sg-inc',
      'sg-keybindings',
      'sg-keyboard',
      'sg-lvl',
      'sg-ql',
      'sg-rmsl',
      'sg-rid',
      'sg-s2keys',
      'sg-s2targeting',
      'sg-setkey',
      'sg-setkey-code',
      'sg-setkey-done',
      'sg-setkey-key',
      'sg-setkey-select',
      'sg-targeting',
      'sg-version' ];

SGPvPUI.prototype.setUIElement = function(div) {
    this.ui_element = div;
    var doc = this.doc, sgpvp = this.sgpvp;

    // Centre it
    //var screen_width = doc.body.offsetWidth;
    div.style.left = ((doc.body.clientWidth - 600) / 2) + 'px';

    // Get the elements we use for controlling the UI
    var e = new Object();
    this.elements = e;
    for(var i in this.UI_ELEMENT_IDS) {
        var id = this.UI_ELEMENT_IDS[i];
        e[id.substr(3).replace('-','_')] = doc.getElementById(id);
    }

    e.version.textContent = sgpvp.getVersion();

    this.actionNames = new Object();

    // handlers
    var self = this,
    switchToTargeting = function() { self.switchToPanel('targeting'); },
    switchToKeys = function() { self.switchToPanel('bindings'); },
    targetingInput = function() { self.targetingDataInputHandler(); },
    armourInput = function() { self.armourInputHandler(); },
    rtidInput = function() { self.rtidInputHandler(); },
    rmslClick = function() { self.rmslClickHandler(); },
    close = function() { self.close(); },
    keyClick = function(event) { self.switchToSetKey(event.currentTarget); },
    setKeySelect = function() { self.setKeySelectChangeHandler(); },
    defaultKeys = function() { self.resetKeyMap('default_keymap'); },
    illarionKeys = function() { self.resetKeyMap('illarion_keymap'); },
    configure = function() {
        self.keymap = sgpvp.keymap;
        e.ql.value = sgpvp.ql;
        var targetingData = sgpvp.targeting;
        e.inc.value = self.stringifyOverrideList(targetingData.include);
        e.exc.value = self.stringifyOverrideList(targetingData.exclude);
        e.rid.value = sgpvp.rtid;
        var armourData = sgpvp.armour;
        e.arm.value = armourData.points;
        e.lvl.value = armourData.level;
        if(sgpvp.rmsl)
            e.rmsl.checked = true;

        self.targetingValid = true;
        self.armourValid = true;
        self.rtidValid = true;

        e.s2targeting.addEventListener('click', switchToTargeting, false);
        e.s2keys.addEventListener('click', switchToKeys, false);
        e.ql.addEventListener('input', targetingInput, false);
        e.inc.addEventListener('input', targetingInput, false);
        e.exc.addEventListener('input', targetingInput, false);
        e.rid.addEventListener('input', rtidInput, false);
        e.arm.addEventListener('input', armourInput, false);
        e.lvl.addEventListener('input', armourInput, false);
        e.rmsl.addEventListener('click', rmslClick, false);
        e.close.addEventListener('click', close, false);
        e.setkey_done.addEventListener('click', switchToKeys, false);
        e.setkey_select.addEventListener('change', setKeySelect, false);
        e.default_keymap.addEventListener('click', defaultKeys, false);
        e.illarion_keymap.addEventListener('click', illarionKeys, false);

        // We fetch the human names for actions from #sg-setkey-select.
        // Hey they're needed there anyway, and this saves code.
        var xpr = doc.evaluate('.//option', e.setkey_select, null,
                               XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                               null);
        var kopt;
        while((kopt = xpr.iterateNext())) {
            var val = kopt.value;
            if(val)
                self.actionNames[val] = kopt.textContent;
        }

        // Bind the keys
        xpr = doc.evaluate('div', e.keyboard, null,
                           XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
        for(var i = 0, end = xpr.snapshotLength; i < end; i++) {
            var kdiv = xpr.snapshotItem(i);
            var code = parseInt(kdiv.id.substr(4));
            var action = self.keymap[code];
            if(action)
                self.setKeyLegend(kdiv, action);
            kdiv.addEventListener('click', keyClick, false);
        }
    };

    // load settings and configure
    sgpvp.loadSettings(['keymap', 'ql', 'targeting', 'rtid', 'armour', 'rmsl'],
                       configure);
};

SGPvPUI.prototype.toggle = function() {
    if(this.ui_element)
        this.close();
    else
        this.open();
};

SGPvPUI.prototype.saveKeyMap = function() {
    this.sgpvp.saveSettings({keymap: this.keymap});
};

SGPvPUI.prototype.parseOverrideList = function(list) {
    var a = list.split(/\n|,/);
    var ids = new Object();
    var names = new Object();
    for(var i = 0, end = a.length; i < end; i++) {
        var s = a[i].replace(/^\s+|\s+$/g, '');
        if(s.length > 0) {
            if(/^[0-9]+$/.test(s))
                ids[parseInt(s)] = i+1;
            else
                names[s.toLowerCase()] = i+1;
        }
    }

    return { ids: ids, names: names };
};

SGPvPUI.prototype.parseQL = function(ql) {
    var o;

    ql = ql.replace(/\s+/g, '');
    if(ql.length > 0) {
        var a = ql.split(';');
        if(a.length == 22 || a.length == 23) {
            var inf = this.parseFactionSpec(a[5]);
            if(inf) {
                var ef = this.parseFactionSpec(a[16]);
                if(ef) {
                    o = {
                        ql: ql,
                        parsed: {
                            includeFactions: inf,
                            excludeFactions: ef,
                            includeAlliances: this.parseIDList(a[13]),
                            excludeAlliances: this.parseIDList(a[19]),
                            includeCharacters: this.parseIDList(a[14]),
                            excludeCharacters: this.parseIDList(a[20])
                        }
                    };
                }
            }
        }
    }
    else {
        var no = new Object();
        o = {
            ql: '',
            parsed: {
                includeFactions: no,
                excludeFactions: no,
                includeAlliances: no,
                excludeAlliances: no,
                includeCharacters: no,
                excludeCharacters: no
            }
        };
    }

    return o;
};

SGPvPUI.prototype.FACTIONSPEC_RX = /^\s*(f?)(e?)(u?)(n?)\s*$/;
SGPvPUI.prototype.parseFactionSpec = function(spec) {
    var r;
    var m = this.FACTIONSPEC_RX.exec(spec);
    if(m) {
        r = new Object();
        r['fed'] = m[1] ? true : false;
        r['emp'] = m[2] ? true : false;
        r['uni'] = m[3] ? true : false;
        r['neu'] = m[4] ? true : false;
    }

    return r;
};

SGPvPUI.prototype.parseIDList = function(idlist) {
    var r = new Object(), a = idlist.split(','), n;
    for(var i = 0, end = a.length; i < end; i++) {
        n = parseInt(a[i]);
        if(n > 0)
            r[n] = i+1;
    }
    return r;
};

SGPvPUI.prototype.stringifyOverrideList = function(list_object) {
    var a = new Array();
    for(var id in list_object.ids)
        a[list_object.ids[id] - 1] = id;
    for(var name in list_object.names)
        a[list_object.names[name] - 1] = name;
    return a.join('\n');
};
