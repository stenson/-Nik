(function(){
    
    /* if only console existed everywhere */
    if(console === undefined) { console = {}; console.log = function() {}; }
    
    var
        __n = Nik = {},
        APIBASEURL = "http://api.wordnik.com/api",
        BASEURL = "http://wordnik.com/words",
        config = {};
    /*
        params.api_key - your api key for wordnik - (required, very much so)
    */
    __n.bootWith = function(params) {
        if(params.api_key === undefined) {
            throw("APIKeyException");
        }
        config.api_key = params.api_key; // store it
    };
    
    __n.dictionary = {}; // word objects that we've created
    
    var sortObjectByProperty = function(object) {
        var sortable = [];
        for(var o in object) {
            sortable.push([ o, object[o] ]);
        }
        return sortable.sort();
    };
    
    var detectCallback = function(params) {
        if(params === undefined) {
            params = {};
        }
        else if(typeof params === "function") {
            var callback = params;
            params = {};
            params.callback = callback;
        }
        // now drop in a generic callback if there isn't one
        if(params.callback === undefined) {
            params.callback = function(data) {
                console.log(data);
            };
        }
        return params;
    };
    
    /* wrappers around ajax calls to wordnik's api (json) */
    
    __n.io = {
        _loading: {}, // what is currently loading
        _loaded: {}, // what has already loaded,
        _waiters: {},
        /* main get function, allows simultaneous requests of single resource */
        get: function(params) {
            var callback = params.callback,
                url = this.buildUrl(params);
            // now we determine when/where we serve the data
            if(this._loaded[url]) { // truthy (data is already here!)
                params.callback(this._loaded[url]); // so just ship it!
                return;
            }
            if(this._loading[url] === true) { // someone has already requested this
                this._waiters[url].push(params.callback); // so we'll send it to you
                return;
            }
            else {
                this.request(url,{ api_key: config.api_key },params.callback);
            }
        },
        buildUrl: function(params) {
            var url = [];
            // create the url path
            $.each([
                APIBASEURL,
                params.page + ".json",
                encodeURIComponent(params.word),
                params.method
            ],function(i,pathSegment){
                if(pathSegment !== undefined && pathSegment !== "undefined") {
                    url.push(pathSegment);
                }
            });
            url = url.join("/"); // what we'll use in the hash
            // additionals parameters create a different resource, so...
            // we'll have to add them in (alphabetically) to get a true unique id
            if(params.additionals !== undefined) {
                url += "?";
                var sorted = sortObjectByProperty(params.additionals);
                for(var i = 0; i < sorted.length; i += 1) {
                    url += sorted[i][0]+"="+sorted[i][1]+"&";
                }
                url = url.slice(0,-1); // get rid of last &
            }
            console.log(url);
            return url;
        },
        request: function(url,data,callback) {
            // let everybody know we're in the async process
            this._loading[url] = true;
            this._waiters[url] = [];
            this._waiters[url].push(callback);
            // now the actual ajax
            var that = this;
            $.ajax({ // the actual jquery get request
                url: url,
                type: "GET",
                dataType: "jsonp",
                data: data,
                success: function(data) {
                    that.process(url,data);
                },
                error: function(data) {
                    console.log("ERROR");
                    console.log(data);
                }
            });
        },
        process: function(url,data) {
            this._loaded[url] = data;
            this._loading[url] = false;
            var waiters = this._waiters[url];
            for(var i = 0; i < waiters.length; i += 1) {
                waiters[i](data);
            }
            this._waiters[url];
        }
    };
    
    /*
        Wordnik methods that are kinda global namespace-ish
    */
    
    __n.randomWord = function(params) {
        params = detectCallback(params);
        if(params.guaranteeUnique === true) {
            delete params.guaranteeUnique;
            params._unique = Math.round(Math.random()*10000001);
        }
        var callback = params.callback,
            getOpts = {
                page: "words",
                method: "randomWord",
                callback: callback,
                additionals: params
            };
        delete params.callback;
        // cache clearer (could be its own function)
        delete __n.io._loaded[__n.io.buildUrl(getOpts)];
        __n.io.get(getOpts);
    };
    
    __n.randomWords = function(howMany,params) {
        if(howMany === undefined) {
            howMany = 5;
        }
        params = detectCallback(params);
        __n.io.get({
            page: "words",
            method: "randomWords",
            callback: params.callback
        });
    };
    
    /*
        word object wrapper
        supports both functional and OO-style
    */
    
    __n.Word = function(theWord) {
        this.word = theWord;
        // now enter yourself in the client dictionary
        __n.dictionary[this.word] = this;
    };
    
    __n.Word.prototype = {
        _genericGet: function(params) {
            params = detectCallback(params);
            // swap out non url parameters
            var additionals = params,
                callback = params.callback,
                method = params.method;
            delete params.method;
            delete params.callback;
            var that = this;
            __n.io.get({
                page: "word",
                word: this.word,
                method: method,
                additionals: additionals,
                callback: function(data) {
                    that[method] = data;
                    callback(data);
                }
            });
        }
    };
    
    /*
        dynamically write sugar functions for wordnik method names
    */
    $.each([
            "definitions",
            "bigrams",
            "examples",
            "pronunciations",
            "related",
            "frequency",
            "punctuationFactor"
        ],
        // meta writing of function pairs
        function(i,method){
            var methodName = "get" + method.substring(0,1).toUpperCase() + method.slice(1);
        
            // first is the object-oriented (the real one)
            __n.Word.prototype[methodName] = function(params) {
                params.method = method;
                this._genericGet(params);
            };
        
            // second is the functional rewrite
            __n.Word[method] = function(word,additionals) {
                return new __n.Word(word)[methodName](additionals || {});
            };
        }
    );
    
    /*
        In-code reference on applicable parameters for different functions
    */
    // for global functions
    __n.applicables = {
        randomWord: {
            hasDictionaryDef:"<Boolean>"
        },
        randomWords: {
            hasDictionaryDef:"<Boolean>"
        }
    };
    // for word functions
    __n.applicables.Word = {
        definitions: {
            sourceDictionary:"<enum>"
        }
    };
    
    
})();