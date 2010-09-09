(function(){
    
    /* add local database storage for persistent lookups (reduce api usage) */
    
    /* if only console existed everywhere */
    if(console === undefined) { console = {}; console.log = function() {}; }
    
    var __n = Nik = {},
        APIBASEURL = "http://api.wordnik.com/api",
        BASEURL = "http://wordnik.com/words",
        config = {},
        // adapted from modernizr
        hasLocalStorage = ('localStorage' in window) && window["localStorage"] !== null,
        useLocalStorage = undefined;
    /*
        params.api_key - your api key for wordnik - (required, very much so)
        params.useLocalStorage
    */
    __n.bootWith = function(params) {
        if(params.api_key === undefined) {
            throw("APIKeyException");
        }
        config = params; // user preferences
        if(config.useLocalStorage === undefined) {
            config.useLocalStorage = true;
        }
        useLocalStorage = hasLocalStorage && config.useLocalStorage === true;
    };
    
    /* helper functions */
    
    /*
        mask ajax/remote file calls for jQuery (client) and node.js (server)
    */
    var remoteRead = function(params) {
        if(jQuery !== undefined) { // we have jQuery
            $.ajax(params); // just masking the call
        }
        else {
            console.log("we do not have jQuery");
            // not yet supported
        }
    };
    
    var iterate = function(array,callback) {
        var length = array.length;
        for(var i = 0; i < length; i += 1) {
            callback(i,array[i]);
        }
    };
    
    // alphabetizes by key
    // { dog:"walk", cat:"prowl" } becomes [["cat","prowl"],["dog","walk"]];
    var sortObjectByProperty = function(object) {
        var sortable = [];
        for(var o in object) {
            sortable.push([ o, object[o] ]);
        }
        return sortable.sort();
    };
    
    // just does a deep copy, since js is reference-passing
    var cloneObject = function(object) {
        var clone = {};
        for(var o in object) {
            clone[o] = object[o];
        }
        return clone;
    };
    
    // allows params hash to be just a function, if you don't want to pass params
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
    
    var _queuer = undefined; // timeout function for batches
    
    __n.io = {
        _loading: {}, // what is currently loading
        _loaded: {}, // what has already loaded,
        _waiters: {},
        _queue: [], // for batch responses
        /* main get function, allows simultaneous requests of single resource */
        get: function(_params) {
            var params = cloneObject(_params),
                fresh = params.fresh,
                callback = params.callback,
                page = params.page;
            delete params.fresh; // not relevant to url
            delete params.callback; // not relevant to url
            // now get the unique url, which will serve as the key
            var url = this.buildUrl(params);
            if(fresh === true) {
                delete this._loaded[url];
                if(useLocalStorage) {
                    localStorage.removeItem(url);
                }
            }
            // now we determine when/where we serve the data
            if(useLocalStorage && localStorage.getItem(url) !== null) {
                callback(JSON.parse(localStorage.getItem(url)));
            }
            else if(this._loaded[url]) { // truthy (data is already here!)
                callback(this._loaded[url]); // so just ship it!
            }
            else {
                if(this._waiters[url] === undefined) {
                    this._waiters[url] = [];
                }
                // no matter the request status, we push the callback
                this._waiters[url].push(callback);
                if(this._loading[url] !== true) {
                    this._loading[url] = true; // let other requesters know we're busy
                    if(page === "word") {
                        this._queue.push(url);
                        // kill previous attempts to load batch
                        clearTimeout(_queuer);
                        // now do your best to load it!
                        var that = this;
                        _queuer = setTimeout(function(){
                            that.clearRequestQueue();
                        },5); // just jumping the thread here
                    }
                    else {
                        this.request(url);
                    }
                }
            }
            //that.request(url,{ api_key: config.api_key },params.callback);
        },
        buildUrl: function(params) {
            var url = [];
            // create the url path
            iterate([
                APIBASEURL,
                params.page + ".json",
                encodeURIComponent(params.word),
                params.method
            ],function(i,pathSegment){
                if(pathSegment !== undefined && pathSegment !== "undefined") {
                    url.push(pathSegment);
                }
            });
            delete params.page; // not part of querystring
            delete params.word; // not part of querystring
            delete params.method; // not part of querystring
            url = url.join("/"); // what we'll use in the hash
            // additionals parameters create a different resource, so...
            // we'll have to add them in (alphabetically) to get a true unique url-key
            url += "?";
            var sorted = sortObjectByProperty(params);
            for(var i = 0; i < sorted.length; i += 1) {
                url += sorted[i][0]+"="+sorted[i][1]+"&";
            }
            url = url.slice(0,-1); // get rid of last &
            console.log(url);
            return url;
        },
        request: function(url) {
            var that = this;
            remoteRead({ // the actual jquery get request
                url: url,
                type: "GET",
                dataType: "jsonp",
                data: { api_key: config.api_key },
                success: function(data) {
                    that.process(url,data);
                },
                error: function(data) {
                    console.log("ERROR");
                    console.log(data);
                }
            });
        },
        clearRequestQueue: function() {
            // make a copy of the queue
            var queue = this._queue,
                length = queue.length,
                batchUrl = APIBASEURL+"/word.json?multi&",
                that = this;
            this.queue = []; // empty the queue, let it build up again
            if(length === 1) {
                this.request(queue[0]);
                return;
            }
            // while this is emptying
            // now we build the batch request url
            for(var i = 0; i < length; i += 1) {
                // requires some fairly complicated queryString rewriting
                var index = i + 1, // wordnik string indexing is 1,2,3
                    stub = queue[i].replace(APIBASEURL+"/word.json/","");
                batchUrl += "resource."+index+"="+stub+"&";
            }
            remoteRead({
                url: batchUrl.slice(0,-1),
                type: "GET",
                dataType: "jsonp",
                data: { api_key: config.api_key },
                success: function(data) {
                    that.processBatch(queue,data);
                }
            });
            // once you get back the concat request
            // run "process" on each url, with the reconstituted long url
        },
        process: function(url,data) {
            this._loaded[url] = data;
            this._loading[url] = false;
            var waiters = this._waiters[url];
            for(var i = 0; i < waiters.length; i += 1) {
                waiters[i](data);
            }
            this._waiters[url] = [];
            this.putInStorage(url,data);
        },
        processBatch: function(queue,response) {
            var responseItems = response.responseItems,
                length = responseItems.length,
                that = this;
            for(var i = 0; i < length; i += 1) {
                // process each one individually
                that.process(queue[i],responseItems[i].responseContent);
            }
        },
        putInStorage: function(url,data) {
            // if we can, might as well, right? (may change)
            if(hasLocalStorage) {
                localStorage.setItem(url,JSON.stringify(data));
            }
        }
    };
    
    /*
        Wordnik methods that are kinda global namespace-ish
        and all pretty similar
    */
    
    var globalFunctions = [
        {
            method: "randomWord",
            page: "words",
            fresh: true
        },{
            method: "randomWords",
            page: "words",
            fresh: true
        },{
            method: "apiTokenStatus",
            page: "account",
            fresh: true
        }
    ];
    iterate(globalFunctions,function(i,info){
        __n[info.method] = function(params) {
            params = detectCallback(params);
            params.page = info.page;
            params.method = info.method;
            params.fresh = info.fresh;
            __n.io.get(params);
        };
    });
    
    __n.dictionary = {}; // word objects that we've created
    
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
            // swap out non url parameters
            var that = this,
                callback = params.callback;
            params.word = this.word;
            params.page = "word";
            params.callback = function(data) {
                that[params.method] = data;
                callback(data);
            };
            __n.io.get(params);
        }
    };
    
    __n.word = { }; // namespace for functional approach
    
    /*
        dynamically write sugar functions for wordnik method names
    */
    iterate([
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
                params = detectCallback(params);
                params.method = method;
                this._genericGet(params);
            };
        
            // second is the functional rewrite
            __n.word[method] = function(word,params) {
                return new __n.Word(word)[methodName](params || {});
            };
        }
    );
    
    // additional helpful static text functions
    // tokenize
    __n.Appendix = {
        tokenize: function(text) {
            
        }
    };
    
})();