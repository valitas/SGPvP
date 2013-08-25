// SGPvP object - user interface methods.
// 
// This code is not loaded unless the user interface has to be shown,
// to keep things fast.
// 
// This code must run in Firefox and Google Chrome - no Greasemonkey
// calls and no chrome.* APIs here.  localStorage should not be
// accessed from here either.

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
      'sg-rid',
      'sg-setkey',
      'sg-setkey-code',
      'sg-setkey-done',
      'sg-setkey-key',
      'sg-setkey-select',
      'sg-switch-keys',
      'sg-switch-targeting',
      'sg-targeting',
      'sg-version' ];

SGPvPUI.prototype.setUIElement = function(div) {
    this.ui_element = div;
    var doc  = this.doc;

    // Centre it
    //var screen_width = doc.body.offsetWidth;
    div.style.left = ((doc.body.clientWidth - 600) / 2) + 'px';

    // Get the elements we use for controlling the UI
    var e = new Object();
    for(var i in this.UI_ELEMENT_IDS) {
        var id = this.UI_ELEMENT_IDS[i];
        e[id.substr(3).replace('-','_')] = doc.getElementById(id);
    }

    e.version.textContent = this.sgpvp.getVersion();

    // handlers
    var self = this;
    var timer;
    var keymap;
    var setKey, setKeyId;
    var actionName = new Object();
    var func = {
        switchToTargeting: function() {
            e.switch_targeting.className = 'active';
            e.switch_keys.className = '';
            e.targeting.style.display = 'block';
            e.keybindings.style.display = 'none';
            e.setkey.style.display = 'none';
            // Flaky, should validate targeting contents...
            func.setCloseButtonEnabled(true);
        },
        switchToKeybindings: function() {
            e.switch_targeting.className = '';
            e.switch_keys.className = 'active';
            e.targeting.style.display = 'none';
            e.keybindings.style.display = 'block';
            e.setkey.style.display = 'none';
            // Flaky, should validate targeting contents...
            func.setCloseButtonEnabled(true);
        },
        switchToSetKey: function(keydiv) {
            // Switch to setkeys
            setKey = keydiv;
            setKeyId = parseInt(keydiv.id.substr(4));
            var cap = keydiv.firstChild.textContent; // bit flaky but succinct
            var action = keymap[setKeyId];

            e.keybindings.style.display = 'none';
            e.setkey.style.display = 'block';
            e.setkey_code.textContent = setKeyId;
            e.setkey_key.textContent = cap;
            func.setSelectedAction(action);
            // Flaky, should validate targeting contents...
            func.setCloseButtonEnabled(false);
        },
        setSelectedAction: function(action) {
            if(!action)
                action = '';
            var opts = e.setkey_select.options;
            for(var i = 0, end = opts.length; i < end; i++) {
                var opt = opts.item(i);
                if(action == opt.value) {
                    e.setkey_select.selectedIndex = i;
                    func.setKeyLegend(e.setkey_key, action);
                    break;
                }
            }
        },
        keyClickHandler: function(event) {
            func.switchToSetKey(event.currentTarget);
        },
        setKeyLegend: function(key, action) {
            var legend = actionName[action];
            if(!legend)
                legend = action;

            var legenddiv = key.firstElementChild;
            if(!legenddiv) {
                legenddiv = key.ownerDocument.createElement('div');
                key.appendChild(legenddiv);
            }

            legenddiv.textContent = legend;
        },
        setKeySelectChangeHandler: function() {
            var opts = e.setkey_select.options;
            var action = opts[e.setkey_select.selectedIndex].value;
            func.setKeyLegend(e.setkey_key, action);
            func.setKeyLegend(setKey, action);
            if(action)
                keymap[setKeyId] = action;
            else
                delete keymap[setKeyId];
            self.saveKeyMap(keymap);
        },
        setCloseButtonEnabled: function(enabled) {
            if(enabled) {
                e.close.disabled = false;
                e.close.style.borderColor = '';
                e.close.style.color = '';
            }
            else {
                e.close.disabled = true;
                e.close.style.borderColor = 'rgb(0,0,28)';
                e.close.style.color = 'rgb(56,56,84)';
            }
        },
        saveTargetingData: function() {
            if(self.saveTargetingData(e.ql.value, e.inc.value, e.exc.value,
                                      e.rid.value, e.arm.value, e.lvl.value))
                func.setCloseButtonEnabled(true);
            timer = null;
        },
        targetingControlChangeHandler: function() {
            func.setCloseButtonEnabled(false);
            if(timer)
                window.clearTimeout(timer);
            timer = window.setTimeout(func.saveTargetingData, 500);
        },
        closeHandler: function() { self.close(); },
        configure: function(cfg) {
            keymap = cfg.keymap;
            e.ql.value = cfg.ql;
            var targetingData = cfg.targeting;
            e.inc.value = self.stringifyOverrideList(targetingData.include);
            e.exc.value = self.stringifyOverrideList(targetingData.exclude);
            e.rid.value = cfg.rtid;
            var armourData = cfg.armour;
            e.arm.value = armourData.points;
            e.lvl.value = armourData.level;

            e.switch_targeting.addEventListener('click', func.switchToTargeting, false);
            e.switch_keys.addEventListener('click', func.switchToKeybindings, false);
            e.ql.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.inc.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.exc.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.rid.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.arm.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.lvl.addEventListener('keyup', func.targetingControlChangeHandler, false);
            e.close.addEventListener('click', func.closeHandler, false);
            e.setkey_done.addEventListener('click', func.switchToKeybindings, false);
            e.setkey_select.addEventListener('change', func.setKeySelectChangeHandler, false);

            // We fetch the human names for actions from #sg-setkey-select.
            // Hey they're needed there anyway, and this saves code.
            var xpr = doc.evaluate('.//option', e.setkey_select, null,
                                   XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
            var kopt;
            while((kopt = xpr.iterateNext())) {
                var val = kopt.value;
                if(val)
                    actionName[val] = kopt.textContent;
            }

            // Bind the keys
            xpr = doc.evaluate('div', e.keyboard, null,
                               XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
            for(var i = 0, end = xpr.snapshotLength; i < end; i++) {
                var kdiv = xpr.snapshotItem(i);
                var code = parseInt(kdiv.id.substr(4));
                var action = keymap[code];
                if(action)
                    func.setKeyLegend(kdiv, action);
                kdiv.addEventListener('click', func.keyClickHandler, false);
            }
        }
    };

    // load settings and configure
    this.sgpvp.loadSettings(['keymap', 'ql', 'targeting',
                             'rtid', 'armour'],
                            func.configure);
};

SGPvPUI.prototype.close = function() {
    if(this.ui_element) {
        this.ui_element.parentNode.removeChild(this.ui_element);
        delete this.ui_element;
    }
};

SGPvPUI.prototype.saveKeyMap = function(keymap) {
    this.sgpvp.setKeyMap(keymap);
};

SGPvPUI.prototype.saveTargetingData = function(ql,
                                               include_overrides,
                                               exclude_overrides,
                                               retreat_tile,
                                               armour_points, armour_level) {
    var ok;

    armour_points = parseInt(armour_points);
    armour_level = parseInt(armour_level);
    if(armour_points > 0 && armour_level > 0 && armour_level <= 6) {
        var qo = this.parseQL(ql);
        if(qo) {
            var o = {
                ql: qo.parsed,
                include: this.parseOverrideList(include_overrides),
                exclude: this.parseOverrideList(exclude_overrides)
            };

            this.sgpvp.storeSettings({ ql: qo.ql,
                                       targeting: o,
                                       rtid: retreat_tile,
                                       armour: {points: armour_points,
                                                level: armour_level} });
            ok = true;
        }
    }

    return ok;
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
