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

    if(doc.getElementById('sgpvp-style'))
        return;

    var head = doc.evaluate('/html/head', doc, null,
                                 XPathResult.ANY_UNORDERED_NODE_TYPE,
                                 null).singleNodeValue;
    var link = doc.createElement('link');
    link.id = 'sgpvp-style';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = this.sgpvp.getResourceURL('style');
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

    doc.getElementById('sgpvp-version').textContent = this.sgpvp.getVersion();
    var swt = doc.getElementById('sgpvp-switch-targeting');
    var swk = doc.getElementById('sgpvp-switch-keys');
    var pant = doc.getElementById('sgpvp-targeting');
    var pank = doc.getElementById('sgpvp-keys');
    var ql_ta = doc.getElementById('sgpvp-ql');
    var inc_ta = doc.getElementById('sgpvp-inc');
    var exc_ta = doc.getElementById('sgpvp-exc');
    var rid_field = doc.getElementById('sgpvp-rid');
    var arm_field = doc.getElementById('sgpvp-arm');
    var lvl_field = doc.getElementById('sgpvp-lvl');
    var setkey_prompt = doc.getElementById('sgpvp-setkey-prompt');
    var setkey_prompt_default = setkey_prompt.textContent;
    var close_but = doc.getElementById('sgpvp-close');

    // handlers
    var self = this;
    var switch_targeting = function() {
        swt.className = 'active';
        swk.className = '';
        pant.style.display = 'table';
        pank.style.display = 'none';
    };
    var switch_keys = function() {
        swt.className = '';
        swk.className = 'active';
        pant.style.display = 'none';
        pank.style.display = 'table';
    };
    var enable_button = function(enabled) {
        if(enabled) {
            close_but.disabled = false;
            close_but.style.borderColor = 'inherit';
            close_but.style.color = 'inherit';
        }
        else {
            close_but.disabled = true;
            close_but.style.borderColor = 'rgb(0,0,28)';
            close_but.style.color = 'rgb(56,56,84)';
        }
    };
    var timer;
    var save_handler = function() {
        if(self.saveTargetingData(ql_ta.value, inc_ta.value, exc_ta.value,
                                  rid_field.value, arm_field.value,
                                  lvl_field.value))
            enable_button(true);
        timer = null;
    };
    var change_handler = function() {
        enable_button(false);
        if(timer)
            clearTimeout(timer);
        timer = window.setTimeout(save_handler, 500);
    };
    var setkey_td;
    var setkey_handler = function(k) {
        var keyname;

        if((k >= 48 && k <= 57) || (k >= 65 && k <= 90))
            keyname = String.fromCharCode(k);
        else
            keyname = '<key ' + k + '>';

        setkey_prompt.textContent = setkey_prompt_default;
        setkey_td.textContent = keyname;
        self.sgpvp.setkey_handler = null;
    };
    var setkey_start = function(e) {
        var th = e.target;
        setkey_prompt.textContent = 'Type the key for ' +
            th.textContent.toLowerCase() + ' or press ESC to cancel.';
        self.sgpvp.setkey_handler = setkey_handler;
        setkey_td = th.nextElementSibling;
    };
    var close_handler = function() { self.close(); };

    var configure = function(results) {
        ql_ta.value = results[0];
        var targetingData = results[1];
        inc_ta.value = self.stringifyOverrideList(targetingData.include);
        exc_ta.value = self.stringifyOverrideList(targetingData.exclude);
        rid_field.value = results[2];
        var armourData = results[3];
        arm_field.value = armourData.points;
        lvl_field.value = armourData.level;

        swt.addEventListener('click', switch_targeting, false);
        swk.addEventListener('click', switch_keys, false);
        ql_ta.addEventListener('keyup', change_handler, false);
        inc_ta.addEventListener('keyup', change_handler, false);
        exc_ta.addEventListener('keyup', change_handler, false);
        rid_field.addEventListener('keyup', change_handler, false);
        arm_field.addEventListener('keyup', change_handler, false);
        lvl_field.addEventListener('keyup', change_handler, false);
        close_but.addEventListener('click', close_handler, false);

        var ths = pank.getElementsByTagName('th');
        for(var i = 0, end = ths.length; i < end; i++) {
            ths[i].addEventListener('click', setkey_start, false);
        }
    };

    // load settings and configure
    this.sgpvp.loadSettings(['textQL', 'targetingData',
                             'retreatTile', 'armourData'],
                            configure);
    this.ui_element = div;
};

SGPvPUI.prototype.close = function() {
    if(this.ui_element) {
        this.ui_element.parentNode.removeChild(this.ui_element);
        delete this.ui_element;
    }
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

            this.sgpvp.storeSettings({ targetingData: {ql: qo.ql, data: o},
                                       retreatTile: retreat_tile,
                                       armourData: {points: armour_points,
                                                    level: armour_level} });
            ok = true;
        }
    }

    return ok;
};

SGPvPUI.prototype.parseOverrideList = function(list) {
    var a = list.split('\n');
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
