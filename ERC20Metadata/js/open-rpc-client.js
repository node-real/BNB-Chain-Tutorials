(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.OpenRpcClient = {}));
})(this, (function (exports) { 'use strict';

  var domain;

  // This constructor is used to store event handlers. Instantiating this is
  // faster than explicitly calling `Object.create(null)` to get a "clean" empty
  // object (tested with v8 v4.9).
  function EventHandlers() {}
  EventHandlers.prototype = Object.create(null);

  function EventEmitter() {
    EventEmitter.init.call(this);
  }

  // nodejs oddity
  // require('events') === require('events').EventEmitter
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.usingDomains = false;

  EventEmitter.prototype.domain = undefined;
  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

  EventEmitter.init = function() {
    this.domain = null;
    if (EventEmitter.usingDomains) {
      // if there is an active domain, then attach to it.
      if (domain.active ) ;
    }

    if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
      this._events = new EventHandlers();
      this._eventsCount = 0;
    }

    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || isNaN(n))
      throw new TypeError('"n" argument must be a positive number');
    this._maxListeners = n;
    return this;
  };

  function $getMaxListeners(that) {
    if (that._maxListeners === undefined)
      return EventEmitter.defaultMaxListeners;
    return that._maxListeners;
  }

  EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
    return $getMaxListeners(this);
  };

  // These standalone emit* functions are used to optimize calling of event
  // handlers for fast cases because emit() itself often has a variable number of
  // arguments and can be deoptimized because of that. These functions always have
  // the same number of arguments and thus do not get deoptimized, so the code
  // inside them can execute faster.
  function emitNone(handler, isFn, self) {
    if (isFn)
      handler.call(self);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self);
    }
  }
  function emitOne(handler, isFn, self, arg1) {
    if (isFn)
      handler.call(self, arg1);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1);
    }
  }
  function emitTwo(handler, isFn, self, arg1, arg2) {
    if (isFn)
      handler.call(self, arg1, arg2);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2);
    }
  }
  function emitThree(handler, isFn, self, arg1, arg2, arg3) {
    if (isFn)
      handler.call(self, arg1, arg2, arg3);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].call(self, arg1, arg2, arg3);
    }
  }

  function emitMany(handler, isFn, self, args) {
    if (isFn)
      handler.apply(self, args);
    else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        listeners[i].apply(self, args);
    }
  }

  EventEmitter.prototype.emit = function emit(type) {
    var er, handler, len, args, i, events, domain;
    var doError = (type === 'error');

    events = this._events;
    if (events)
      doError = (doError && events.error == null);
    else if (!doError)
      return false;

    domain = this.domain;

    // If there is no 'error' event listener then throw.
    if (doError) {
      er = arguments[1];
      if (domain) {
        if (!er)
          er = new Error('Uncaught, unspecified "error" event');
        er.domainEmitter = this;
        er.domain = domain;
        er.domainThrown = false;
        domain.emit('error', er);
      } else if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
      return false;
    }

    handler = events[type];

    if (!handler)
      return false;

    var isFn = typeof handler === 'function';
    len = arguments.length;
    switch (len) {
      // fast cases
      case 1:
        emitNone(handler, isFn, this);
        break;
      case 2:
        emitOne(handler, isFn, this, arguments[1]);
        break;
      case 3:
        emitTwo(handler, isFn, this, arguments[1], arguments[2]);
        break;
      case 4:
        emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
        break;
      // slower
      default:
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        emitMany(handler, isFn, this, args);
    }

    return true;
  };

  function _addListener(target, type, listener, prepend) {
    var m;
    var events;
    var existing;

    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');

    events = target._events;
    if (!events) {
      events = target._events = new EventHandlers();
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

    if (!existing) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] = prepend ? [listener, existing] :
                                            [existing, listener];
      } else {
        // If we've already got an array, just append.
        if (prepend) {
          existing.unshift(listener);
        } else {
          existing.push(listener);
        }
      }

      // Check for listener leak
      if (!existing.warned) {
        m = $getMaxListeners(target);
        if (m && m > 0 && existing.length > m) {
          existing.warned = true;
          var w = new Error('Possible EventEmitter memory leak detected. ' +
                              existing.length + ' ' + type + ' listeners added. ' +
                              'Use emitter.setMaxListeners() to increase limit');
          w.name = 'MaxListenersExceededWarning';
          w.emitter = target;
          w.type = type;
          w.count = existing.length;
          emitWarning(w);
        }
      }
    }

    return target;
  }
  function emitWarning(e) {
    typeof console.warn === 'function' ? console.warn(e) : console.log(e);
  }
  EventEmitter.prototype.addListener = function addListener(type, listener) {
    return _addListener(this, type, listener, false);
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.prependListener =
      function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };

  function _onceWrap(target, type, listener) {
    var fired = false;
    function g() {
      target.removeListener(type, g);
      if (!fired) {
        fired = true;
        listener.apply(target, arguments);
      }
    }
    g.listener = listener;
    return g;
  }

  EventEmitter.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('"listener" argument must be a function');
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };

  EventEmitter.prototype.prependOnceListener =
      function prependOnceListener(type, listener) {
        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };

  // emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener =
      function removeListener(type, listener) {
        var list, events, position, i, originalListener;

        if (typeof listener !== 'function')
          throw new TypeError('"listener" argument must be a function');

        events = this._events;
        if (!events)
          return this;

        list = events[type];
        if (!list)
          return this;

        if (list === listener || (list.listener && list.listener === listener)) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else {
            delete events[type];
            if (events.removeListener)
              this.emit('removeListener', type, list.listener || listener);
          }
        } else if (typeof list !== 'function') {
          position = -1;

          for (i = list.length; i-- > 0;) {
            if (list[i] === listener ||
                (list[i].listener && list[i].listener === listener)) {
              originalListener = list[i].listener;
              position = i;
              break;
            }
          }

          if (position < 0)
            return this;

          if (list.length === 1) {
            list[0] = undefined;
            if (--this._eventsCount === 0) {
              this._events = new EventHandlers();
              return this;
            } else {
              delete events[type];
            }
          } else {
            spliceOne(list, position);
          }

          if (events.removeListener)
            this.emit('removeListener', type, originalListener || listener);
        }

        return this;
      };

  EventEmitter.prototype.removeAllListeners =
      function removeAllListeners(type) {
        var listeners, events;

        events = this._events;
        if (!events)
          return this;

        // not listening for removeListener, no need to emit
        if (!events.removeListener) {
          if (arguments.length === 0) {
            this._events = new EventHandlers();
            this._eventsCount = 0;
          } else if (events[type]) {
            if (--this._eventsCount === 0)
              this._events = new EventHandlers();
            else
              delete events[type];
          }
          return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          for (var i = 0, key; i < keys.length; ++i) {
            key = keys[i];
            if (key === 'removeListener') continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners('removeListener');
          this._events = new EventHandlers();
          this._eventsCount = 0;
          return this;
        }

        listeners = events[type];

        if (typeof listeners === 'function') {
          this.removeListener(type, listeners);
        } else if (listeners) {
          // LIFO order
          do {
            this.removeListener(type, listeners[listeners.length - 1]);
          } while (listeners[0]);
        }

        return this;
      };

  EventEmitter.prototype.listeners = function listeners(type) {
    var evlistener;
    var ret;
    var events = this._events;

    if (!events)
      ret = [];
    else {
      evlistener = events[type];
      if (!evlistener)
        ret = [];
      else if (typeof evlistener === 'function')
        ret = [evlistener.listener || evlistener];
      else
        ret = unwrapListeners(evlistener);
    }

    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    if (typeof emitter.listenerCount === 'function') {
      return emitter.listenerCount(type);
    } else {
      return listenerCount.call(emitter, type);
    }
  };

  EventEmitter.prototype.listenerCount = listenerCount;
  function listenerCount(type) {
    var events = this._events;

    if (events) {
      var evlistener = events[type];

      if (typeof evlistener === 'function') {
        return 1;
      } else if (evlistener) {
        return evlistener.length;
      }
    }

    return 0;
  }

  EventEmitter.prototype.eventNames = function eventNames() {
    return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
  };

  // About 1.5x faster than the two-arg version of Array#splice().
  function spliceOne(list, index) {
    for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
      list[i] = list[k];
    list.pop();
  }

  function arrayClone(arr, i) {
    var copy = new Array(i);
    while (i--)
      copy[i] = arr[i];
    return copy;
  }

  function unwrapListeners(arr) {
    var ret = new Array(arr.length);
    for (var i = 0; i < ret.length; ++i) {
      ret[i] = arr[i].listener || arr[i];
    }
    return ret;
  }

  var __awaiter$5 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  const defaultNextRequest = () => {
      let lastId = -1;
      return () => ++lastId;
  };
  /*
  ** Naive Request Manager, only use 1st transport.
   * A more complex request manager could try each transport.
   * If a transport fails, or times out, move on to the next.
   */
  class RequestManager {
      constructor(transports, nextID = defaultNextRequest()) {
          this.batch = [];
          this.batchStarted = false;
          this.lastId = -1;
          this.transports = transports;
          this.requests = {};
          this.connectPromise = this.connect();
          this.requestChannel = new EventEmitter();
          this.nextID = nextID;
      }
      connect() {
          return Promise.all(this.transports.map((transport) => __awaiter$5(this, void 0, void 0, function* () {
              transport.subscribe("error", this.handleError.bind(this));
              transport.subscribe("notification", this.handleNotification.bind(this));
              yield transport.connect();
          })));
      }
      getPrimaryTransport() {
          return this.transports[0];
      }
      request(requestObject, notification = false, timeout) {
          return __awaiter$5(this, void 0, void 0, function* () {
              const internalID = this.nextID().toString();
              const id = notification ? null : internalID;
              // naively grab first transport and use it
              const payload = { request: this.makeRequest(requestObject.method, requestObject.params || [], id), internalID };
              if (this.batchStarted) {
                  const result = new Promise((resolve, reject) => {
                      this.batch.push({ resolve, reject, request: payload });
                  });
                  return result;
              }
              return this.getPrimaryTransport().sendData(payload, timeout);
          });
      }
      close() {
          this.requestChannel.removeAllListeners();
          this.transports.forEach((transport) => {
              transport.unsubscribe();
              transport.close();
          });
      }
      /**
       * Begins a batch call by setting the [[RequestManager.batchStarted]] flag to `true`.
       *
       * [[RequestManager.batch]] is a singleton - only one batch can exist at a given time, per [[RequestManager]].
       *
       */
      startBatch() {
          this.batchStarted = true;
      }
      stopBatch() {
          if (this.batchStarted === false) {
              throw new Error("cannot end that which has never started");
          }
          if (this.batch.length === 0) {
              this.batchStarted = false;
              return;
          }
          this.getPrimaryTransport().sendData(this.batch);
          this.batch = [];
          this.batchStarted = false;
      }
      makeRequest(method, params, id) {
          if (id) {
              return { jsonrpc: "2.0", id, method, params };
          }
          return { jsonrpc: "2.0", method, params };
      }
      handleError(data) {
          this.requestChannel.emit("error", data);
      }
      handleNotification(data) {
          this.requestChannel.emit("notification", data);
      }
  }

  const ERR_TIMEOUT = 7777;
  const ERR_UNKNOWN = 7979;
  class JSONRPCError extends Error {
      constructor(message, code, data) {
          super(message);
          this.message = message;
          this.code = code;
          this.data = data;
          Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain: see https://github.com/open-rpc/client-js/issues/209
      }
  }
  const convertJSONToRPCError = (payload) => {
      if (payload.error) {
          const { message, code, data } = payload.error;
          return new JSONRPCError(message, code, data);
      }
      return new JSONRPCError("Unknown error", ERR_UNKNOWN, payload);
  };

  class TransportRequestManager {
      constructor() {
          this.pendingRequest = {};
          this.pendingBatchRequest = {};
          this.transportEventChannel = new EventEmitter();
      }
      addRequest(data, timeout) {
          this.transportEventChannel.emit("pending", data);
          if (data instanceof Array) {
              this.addBatchReq(data, timeout);
              return Promise.resolve();
          }
          return this.addReq(data.internalID, timeout);
      }
      settlePendingRequest(request, error) {
          request.forEach((req) => {
              const resolver = this.pendingRequest[req.internalID];
              delete this.pendingBatchRequest[req.internalID];
              if (resolver === undefined) {
                  return;
              }
              if (error) {
                  resolver.reject(error);
                  return;
              }
              resolver.resolve();
              // Notifications have no response and should clear their own pending requests
              if (req.request.id === null || req.request.id === undefined) {
                  delete this.pendingRequest[req.internalID];
              }
          });
      }
      isPendingRequest(id) {
          return this.pendingRequest.hasOwnProperty(id);
      }
      resolveResponse(payload, emitError = true) {
          let data = payload;
          try {
              data = JSON.parse(payload);
              if (this.checkJSONRPC(data) === false) {
                  return; // ignore messages that are not conforming to JSON-RPC
              }
              if (data instanceof Array) {
                  return this.resolveBatch(data, emitError);
              }
              return this.resolveRes(data, emitError);
          }
          catch (e) {
              const err = new JSONRPCError("Bad response format", ERR_UNKNOWN, payload);
              if (emitError) {
                  this.transportEventChannel.emit("error", err);
              }
              return err;
          }
      }
      addBatchReq(batches, timeout) {
          batches.forEach((batch) => {
              const { resolve, reject } = batch;
              const { internalID } = batch.request;
              this.pendingBatchRequest[internalID] = true;
              this.pendingRequest[internalID] = { resolve, reject };
          });
          return Promise.resolve();
      }
      addReq(id, timeout) {
          return new Promise((resolve, reject) => {
              if (timeout !== null && timeout) {
                  this.setRequestTimeout(id, timeout, reject);
              }
              this.pendingRequest[id] = { resolve, reject };
          });
      }
      checkJSONRPC(data) {
          let payload = [data];
          if (data instanceof Array) {
              payload = data;
          }
          return payload.every((datum) => (datum.result !== undefined || datum.error !== undefined || datum.method !== undefined));
      }
      processResult(payload, prom) {
          if (payload.error) {
              const err = convertJSONToRPCError(payload);
              prom.reject(err);
              return;
          }
          prom.resolve(payload.result);
      }
      resolveBatch(payload, emitError) {
          const results = payload.map((datum) => {
              return this.resolveRes(datum, emitError);
          });
          const errors = results.filter((result) => result);
          if (errors.length > 0) {
              return errors[0];
          }
          return undefined;
      }
      resolveRes(data, emitError) {
          const { id, error } = data;
          const status = this.pendingRequest[id];
          if (status) {
              delete this.pendingRequest[id];
              this.processResult(data, status);
              this.transportEventChannel.emit("response", data);
              return;
          }
          if (id === undefined && error === undefined) {
              this.transportEventChannel.emit("notification", data);
              return;
          }
          let err;
          if (error) {
              err = convertJSONToRPCError(data);
          }
          if (emitError && error && err) {
              this.transportEventChannel.emit("error", err);
          }
          return err;
      }
      setRequestTimeout(id, timeout, reject) {
          setTimeout(() => {
              delete this.pendingRequest[id];
              reject(new JSONRPCError(`Request timeout request took longer than ${timeout} ms to resolve`, ERR_TIMEOUT));
          }, timeout);
      }
  }

  class Transport {
      constructor() {
          this.transportRequestManager = new TransportRequestManager();
          // add a noop for the error event to not require handling the error event
          // tslint:disable-next-line:no-empty
          this.transportRequestManager.transportEventChannel.on("error", () => { });
      }
      subscribe(event, handler) {
          this.transportRequestManager.transportEventChannel.addListener(event, handler);
      }
      unsubscribe(event, handler) {
          if (!event) {
              return this.transportRequestManager.transportEventChannel.removeAllListeners();
          }
          if (event && handler) {
              this.transportRequestManager.transportEventChannel.removeListener(event, handler);
          }
      }
      parseData(data) {
          if (data instanceof Array) {
              return data.map((batch) => batch.request.request);
          }
          return data.request;
      }
  }

  const isNotification = (data) => {
      return (data.request.id === undefined || data.request.id === null);
  };
  const getBatchRequests = (data) => {
      if (data instanceof Array) {
          return data.filter((datum) => {
              const id = datum.request.request.id;
              return id !== null && id !== undefined;
          }).map((batchRequest) => {
              return batchRequest.request;
          });
      }
      return [];
  };
  const getNotifications = (data) => {
      if (data instanceof Array) {
          return data.filter((datum) => {
              return isNotification(datum.request);
          }).map((batchRequest) => {
              return batchRequest.request;
          });
      }
      if (isNotification(data)) {
          return [data];
      }
      return [];
  };

  class EventEmitterTransport extends Transport {
      constructor(destEmitter, reqUri, resUri) {
          super();
          this.connection = destEmitter;
          this.reqUri = reqUri;
          this.resUri = resUri;
      }
      connect() {
          this.connection.on(this.resUri, (data) => {
              this.transportRequestManager.resolveResponse(data);
          });
          return Promise.resolve();
      }
      sendData(data, timeout = null) {
          const prom = this.transportRequestManager.addRequest(data, timeout);
          const notifications = getNotifications(data);
          const parsedData = this.parseData(data);
          try {
              this.connection.emit(this.reqUri, parsedData);
              this.transportRequestManager.settlePendingRequest(notifications);
              return prom;
          }
          catch (e) {
              const responseErr = new JSONRPCError(e.message, ERR_UNKNOWN, e);
              this.transportRequestManager.settlePendingRequest(notifications, responseErr);
              return Promise.reject(responseErr);
          }
      }
      close() {
          this.connection.removeAllListeners();
      }
  }

  var global$2 =
    (typeof globalThis !== 'undefined' && globalThis) ||
    (typeof self !== 'undefined' && self) ||
    (typeof global$2 !== 'undefined' && global$2);

  var support = {
    searchParams: 'URLSearchParams' in global$2,
    iterable: 'Symbol' in global$2 && 'iterator' in Symbol,
    blob:
      'FileReader' in global$2 &&
      'Blob' in global$2 &&
      (function() {
        try {
          new Blob();
          return true
        } catch (e) {
          return false
        }
      })(),
    formData: 'FormData' in global$2,
    arrayBuffer: 'ArrayBuffer' in global$2
  };

  function isDataView(obj) {
    return obj && DataView.prototype.isPrototypeOf(obj)
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ];

    var isArrayBufferView =
      ArrayBuffer.isView ||
      function(obj) {
        return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
      };
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name);
    }
    if (/[^a-z0-9\-#$%&'*+.^_`|~!]/i.test(name) || name === '') {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift();
        return {done: value === undefined, value: value}
      }
    };

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      };
    }

    return iterator
  }

  function Headers$1(headers) {
    this.map = {};

    if (headers instanceof Headers$1) {
      headers.forEach(function(value, name) {
        this.append(name, value);
      }, this);
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1]);
      }, this);
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name]);
      }, this);
    }
  }

  Headers$1.prototype.append = function(name, value) {
    name = normalizeName(name);
    value = normalizeValue(value);
    var oldValue = this.map[name];
    this.map[name] = oldValue ? oldValue + ', ' + value : value;
  };

  Headers$1.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)];
  };

  Headers$1.prototype.get = function(name) {
    name = normalizeName(name);
    return this.has(name) ? this.map[name] : null
  };

  Headers$1.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  };

  Headers$1.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value);
  };

  Headers$1.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this);
      }
    }
  };

  Headers$1.prototype.keys = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push(name);
    });
    return iteratorFor(items)
  };

  Headers$1.prototype.values = function() {
    var items = [];
    this.forEach(function(value) {
      items.push(value);
    });
    return iteratorFor(items)
  };

  Headers$1.prototype.entries = function() {
    var items = [];
    this.forEach(function(value, name) {
      items.push([name, value]);
    });
    return iteratorFor(items)
  };

  if (support.iterable) {
    Headers$1.prototype[Symbol.iterator] = Headers$1.prototype.entries;
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true;
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result);
      };
      reader.onerror = function() {
        reject(reader.error);
      };
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsArrayBuffer(blob);
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader();
    var promise = fileReaderReady(reader);
    reader.readAsText(blob);
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf);
    var chars = new Array(view.length);

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength);
      view.set(new Uint8Array(buf));
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false;

    this._initBody = function(body) {
      /*
        fetch-mock wraps the Response object in an ES6 Proxy to
        provide useful test harness features such as flush. However, on
        ES5 browsers without fetch or Proxy support pollyfills must be used;
        the proxy-pollyfill is unable to proxy an attribute unless it exists
        on the object before the Proxy is created. This change ensures
        Response.bodyUsed exists on the instance, while maintaining the
        semantic of setting Request.bodyUsed in the constructor before
        _initBody is called.
      */
      this.bodyUsed = this.bodyUsed;
      this._bodyInit = body;
      if (!body) {
        this._bodyText = '';
      } else if (typeof body === 'string') {
        this._bodyText = body;
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body;
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body;
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString();
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer);
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer]);
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body);
      } else {
        this._bodyText = body = Object.prototype.toString.call(body);
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8');
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type);
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
        }
      }
    };

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this);
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      };

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          var isConsumed = consumed(this);
          if (isConsumed) {
            return isConsumed
          }
          if (ArrayBuffer.isView(this._bodyArrayBuffer)) {
            return Promise.resolve(
              this._bodyArrayBuffer.buffer.slice(
                this._bodyArrayBuffer.byteOffset,
                this._bodyArrayBuffer.byteOffset + this._bodyArrayBuffer.byteLength
              )
            )
          } else {
            return Promise.resolve(this._bodyArrayBuffer)
          }
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      };
    }

    this.text = function() {
      var rejected = consumed(this);
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    };

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      };
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    };

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

  function normalizeMethod(method) {
    var upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  }

  function Request(input, options) {
    if (!(this instanceof Request)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }

    options = options || {};
    var body = options.body;

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url;
      this.credentials = input.credentials;
      if (!options.headers) {
        this.headers = new Headers$1(input.headers);
      }
      this.method = input.method;
      this.mode = input.mode;
      this.signal = input.signal;
      if (!body && input._bodyInit != null) {
        body = input._bodyInit;
        input.bodyUsed = true;
      }
    } else {
      this.url = String(input);
    }

    this.credentials = options.credentials || this.credentials || 'same-origin';
    if (options.headers || !this.headers) {
      this.headers = new Headers$1(options.headers);
    }
    this.method = normalizeMethod(options.method || this.method || 'GET');
    this.mode = options.mode || this.mode || null;
    this.signal = options.signal || this.signal;
    this.referrer = null;

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body);

    if (this.method === 'GET' || this.method === 'HEAD') {
      if (options.cache === 'no-store' || options.cache === 'no-cache') {
        // Search for a '_' parameter in the query string
        var reParamSearch = /([?&])_=[^&]*/;
        if (reParamSearch.test(this.url)) {
          // If it already exists then set the value with the current time
          this.url = this.url.replace(reParamSearch, '$1_=' + new Date().getTime());
        } else {
          // Otherwise add a new '_' parameter to the end with the current time
          var reQueryString = /\?/;
          this.url += (reQueryString.test(this.url) ? '&' : '?') + '_=' + new Date().getTime();
        }
      }
    }
  }

  Request.prototype.clone = function() {
    return new Request(this, {body: this._bodyInit})
  };

  function decode(body) {
    var form = new FormData();
    body
      .trim()
      .split('&')
      .forEach(function(bytes) {
        if (bytes) {
          var split = bytes.split('=');
          var name = split.shift().replace(/\+/g, ' ');
          var value = split.join('=').replace(/\+/g, ' ');
          form.append(decodeURIComponent(name), decodeURIComponent(value));
        }
      });
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers$1();
    // Replace instances of \r\n and \n followed by at least one space or horizontal tab with a space
    // https://tools.ietf.org/html/rfc7230#section-3.2
    var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
    preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':');
      var key = parts.shift().trim();
      if (key) {
        var value = parts.join(':').trim();
        headers.append(key, value);
      }
    });
    return headers
  }

  Body.call(Request.prototype);

  function Response(bodyInit, options) {
    if (!(this instanceof Response)) {
      throw new TypeError('Please use the "new" operator, this DOM object constructor cannot be called as a function.')
    }
    if (!options) {
      options = {};
    }

    this.type = 'default';
    this.status = options.status === undefined ? 200 : options.status;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = 'statusText' in options ? options.statusText : '';
    this.headers = new Headers$1(options.headers);
    this.url = options.url || '';
    this._initBody(bodyInit);
  }

  Body.call(Response.prototype);

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers$1(this.headers),
      url: this.url
    })
  };

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''});
    response.type = 'error';
    return response
  };

  var redirectStatuses = [301, 302, 303, 307, 308];

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  };

  var DOMException = global$2.DOMException;
  try {
    new DOMException();
  } catch (err) {
    DOMException = function(message, name) {
      this.message = message;
      this.name = name;
      var error = Error(message);
      this.stack = error.stack;
    };
    DOMException.prototype = Object.create(Error.prototype);
    DOMException.prototype.constructor = DOMException;
  }

  function fetch(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init);

      if (request.signal && request.signal.aborted) {
        return reject(new DOMException('Aborted', 'AbortError'))
      }

      var xhr = new XMLHttpRequest();

      function abortXhr() {
        xhr.abort();
      }

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        };
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
        var body = 'response' in xhr ? xhr.response : xhr.responseText;
        setTimeout(function() {
          resolve(new Response(body, options));
        }, 0);
      };

      xhr.onerror = function() {
        setTimeout(function() {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.ontimeout = function() {
        setTimeout(function() {
          reject(new TypeError('Network request failed'));
        }, 0);
      };

      xhr.onabort = function() {
        setTimeout(function() {
          reject(new DOMException('Aborted', 'AbortError'));
        }, 0);
      };

      function fixUrl(url) {
        try {
          return url === '' && global$2.location.href ? global$2.location.href : url
        } catch (e) {
          return url
        }
      }

      xhr.open(request.method, fixUrl(request.url), true);

      if (request.credentials === 'include') {
        xhr.withCredentials = true;
      } else if (request.credentials === 'omit') {
        xhr.withCredentials = false;
      }

      if ('responseType' in xhr) {
        if (support.blob) {
          xhr.responseType = 'blob';
        } else if (
          support.arrayBuffer &&
          request.headers.get('Content-Type') &&
          request.headers.get('Content-Type').indexOf('application/octet-stream') !== -1
        ) {
          xhr.responseType = 'arraybuffer';
        }
      }

      if (init && typeof init.headers === 'object' && !(init.headers instanceof Headers$1)) {
        Object.getOwnPropertyNames(init.headers).forEach(function(name) {
          xhr.setRequestHeader(name, normalizeValue(init.headers[name]));
        });
      } else {
        request.headers.forEach(function(value, name) {
          xhr.setRequestHeader(name, value);
        });
      }

      if (request.signal) {
        request.signal.addEventListener('abort', abortXhr);

        xhr.onreadystatechange = function() {
          // DONE (success or failure)
          if (xhr.readyState === 4) {
            request.signal.removeEventListener('abort', abortXhr);
          }
        };
      }

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
    })
  }

  fetch.polyfill = true;

  if (!global$2.fetch) {
    global$2.fetch = fetch;
    global$2.Headers = Headers$1;
    global$2.Request = Request;
    global$2.Response = Response;
  }

  // the whatwg-fetch polyfill installs the fetch() function
  // on the global object (window or self)
  //
  // Return that as the export for use in Webpack, Browserify etc.

  var fetchNpmBrowserify = self.fetch.bind(self);

  var __awaiter$4 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  class HTTPTransport extends Transport {
      constructor(uri, options) {
          super();
          this.onlyNotifications = (data) => {
              if (data instanceof Array) {
                  return data.every((datum) => datum.request.request.id === null || datum.request.request.id === undefined);
              }
              return (data.request.id === null || data.request.id === undefined);
          };
          this.uri = uri;
          this.credentials = options && options.credentials;
          this.headers = HTTPTransport.setupHeaders(options && options.headers);
      }
      connect() {
          return Promise.resolve();
      }
      sendData(data, timeout = null) {
          return __awaiter$4(this, void 0, void 0, function* () {
              const prom = this.transportRequestManager.addRequest(data, timeout);
              const notifications = getNotifications(data);
              const batch = getBatchRequests(data);
              try {
                  const result = yield fetchNpmBrowserify(this.uri, {
                      method: "POST",
                      headers: this.headers,
                      body: JSON.stringify(this.parseData(data)),
                      credentials: this.credentials,
                  });
                  // requirements are that notifications are successfully sent
                  this.transportRequestManager.settlePendingRequest(notifications);
                  if (this.onlyNotifications(data)) {
                      return Promise.resolve();
                  }
                  const body = yield result.text();
                  const responseErr = this.transportRequestManager.resolveResponse(body);
                  if (responseErr) {
                      // requirements are that batch requuests are successfully resolved
                      // this ensures that individual requests within the batch request are settled
                      this.transportRequestManager.settlePendingRequest(batch, responseErr);
                      return Promise.reject(responseErr);
                  }
              }
              catch (e) {
                  const responseErr = new JSONRPCError(e.message, ERR_UNKNOWN, e);
                  this.transportRequestManager.settlePendingRequest(notifications, responseErr);
                  this.transportRequestManager.settlePendingRequest(getBatchRequests(data), responseErr);
                  return Promise.reject(responseErr);
              }
              return prom;
          });
      }
      // tslint:disable-next-line:no-empty
      close() { }
      static setupHeaders(headerOptions) {
          const headers = new Headers(headerOptions);
          // Overwrite header options to ensure correct content type.
          headers.set("Content-Type", "application/json");
          return headers;
      }
  }

  var global$1 = (typeof global !== "undefined" ? global :
    typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window : {});

  // https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

  var ws = null;

  if (typeof WebSocket !== 'undefined') {
    ws = WebSocket;
  } else if (typeof MozWebSocket !== 'undefined') {
    ws = MozWebSocket;
  } else if (typeof global$1 !== 'undefined') {
    ws = global$1.WebSocket || global$1.MozWebSocket;
  } else if (typeof window !== 'undefined') {
    ws = window.WebSocket || window.MozWebSocket;
  } else if (typeof self !== 'undefined') {
    ws = self.WebSocket || self.MozWebSocket;
  }

  var WS = ws;

  var __awaiter$3 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  class WebSocketTransport extends Transport {
      constructor(uri) {
          super();
          this.uri = uri;
          this.connection = new WS(uri);
      }
      connect() {
          return new Promise((resolve, reject) => {
              const cb = () => {
                  this.connection.removeEventListener("open", cb);
                  resolve();
              };
              this.connection.addEventListener("open", cb);
              this.connection.addEventListener("message", (message) => {
                  const { data } = message;
                  this.transportRequestManager.resolveResponse(data);
              });
          });
      }
      sendData(data, timeout = 5000) {
          return __awaiter$3(this, void 0, void 0, function* () {
              let prom = this.transportRequestManager.addRequest(data, timeout);
              const notifications = getNotifications(data);
              this.connection.send(JSON.stringify(this.parseData(data)), (err) => {
                  if (err) {
                      const jsonError = new JSONRPCError(err.message, ERR_UNKNOWN, err);
                      this.transportRequestManager.settlePendingRequest(notifications, jsonError);
                      this.transportRequestManager.settlePendingRequest(getBatchRequests(data), jsonError);
                      prom = Promise.reject(jsonError);
                  }
                  this.transportRequestManager.settlePendingRequest(notifications);
              });
              return prom;
          });
      }
      close() {
          this.connection.close();
      }
  }

  var __awaiter$2 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  const openPopup = (url) => {
      const width = 400;
      const height = window.screen.height;
      const left = 0;
      const top = 0;
      return window.open(url, "inspector:popup", `left=${left},top=${top},width=${width},height=${height},resizable,scrollbars=yes,status=1`);
  };
  class PostMessageTransport extends Transport {
      constructor(uri) {
          super();
          this.messageHandler = (ev) => {
              this.transportRequestManager.resolveResponse(JSON.stringify(ev.data));
          };
          this.uri = uri;
          this.postMessageID = `post-message-transport-${Math.random()}`;
      }
      createWindow(uri) {
          return new Promise((resolve, reject) => {
              let frame;
              frame = openPopup(uri);
              setTimeout(() => {
                  resolve(frame);
              }, 3000);
          });
      }
      connect() {
          const urlRegex = /^(http|https):\/\/.*$/;
          return new Promise((resolve, reject) => __awaiter$2(this, void 0, void 0, function* () {
              if (!urlRegex.test(this.uri)) {
                  reject(new Error("Bad URI"));
              }
              this.frame = yield this.createWindow(this.uri);
              window.addEventListener("message", this.messageHandler);
              resolve();
          }));
      }
      sendData(data, timeout = 5000) {
          return __awaiter$2(this, void 0, void 0, function* () {
              const prom = this.transportRequestManager.addRequest(data, null);
              const notifications = getNotifications(data);
              if (this.frame) {
                  this.frame.postMessage(data.request, this.uri);
                  this.transportRequestManager.settlePendingRequest(notifications);
              }
              return prom;
          });
      }
      close() {
          if (this.frame) {
              window.removeEventListener("message", this.messageHandler);
              this.frame.close();
          }
      }
  }

  var __awaiter$1 = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  class PostMessageIframeTransport extends Transport {
      constructor(uri) {
          super();
          this.messageHandler = (ev) => {
              this.transportRequestManager.resolveResponse(JSON.stringify(ev.data));
          };
          this.uri = uri;
          this.postMessageID = `post-message-transport-${Math.random()}`;
      }
      createWindow(uri) {
          return new Promise((resolve, reject) => {
              let frame;
              const iframe = document.createElement("iframe");
              iframe.setAttribute("id", this.postMessageID);
              iframe.setAttribute("width", "0px");
              iframe.setAttribute("height", "0px");
              iframe.setAttribute("style", "visiblity:hidden;border:none;outline:none;");
              iframe.addEventListener("load", () => {
                  resolve(frame);
              });
              iframe.setAttribute("src", uri);
              window.document.body.appendChild(iframe);
              frame = iframe.contentWindow;
          });
      }
      connect() {
          const urlRegex = /^(http|https):\/\/.*$/;
          return new Promise((resolve, reject) => __awaiter$1(this, void 0, void 0, function* () {
              if (!urlRegex.test(this.uri)) {
                  reject(new Error("Bad URI"));
              }
              this.frame = yield this.createWindow(this.uri);
              window.addEventListener("message", this.messageHandler);
              resolve();
          }));
      }
      sendData(data, timeout = 5000) {
          return __awaiter$1(this, void 0, void 0, function* () {
              const prom = this.transportRequestManager.addRequest(data, null);
              const notifications = getNotifications(data);
              if (this.frame) {
                  this.frame.postMessage(data.request, "*");
                  this.transportRequestManager.settlePendingRequest(notifications);
              }
              return prom;
          });
      }
      close() {
          const el = document.getElementById(this.postMessageID);
          el === null || el === void 0 ? void 0 : el.remove();
          window.removeEventListener("message", this.messageHandler);
      }
  }

  var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
      function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
      return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
      });
  };
  /**
   * OpenRPC Client JS is a browser-compatible JSON-RPC client with multiple transports and
   * multiple request managers to enable features like round-robin or fallback-by-position.
   *
   * @example
   * ```typescript
   * import { RequestManager, HTTPTransport, Client } from '@open-rpc/client-js';
   * const transport = new HTTPTransport('http://localhost:3333');
   * const client = new Client(new RequestManager([transport]));
   * const result = await client.request({method: 'addition', params: [2, 2]});
   * // => { jsonrpc: '2.0', id: 1, result: 4 }
   * ```
   *
   */
  class Client {
      constructor(requestManager) {
          this.requestManager = requestManager;
      }
      /**
       * Initiates [[RequestManager.startBatch]] in order to build a batch call.
       *
       * Subsequent calls to [[Client.request]] will be added to the batch. Once [[Client.stopBatch]] is called, the
       * promises for the [[Client.request]] will then be resolved.  If the [[RequestManager]] already has a batch in
       * progress, this method is a noop.
       *
       * @example
       * myClient.startBatch();
       * myClient.request({method: "foo", params: ["bar"]}).then(() => console.log('foobar'));
       * myClient.request({method: "foo", params: ["baz"]}).then(() => console.log('foobaz'));
       * myClient.stopBatch();
       */
      startBatch() {
          return this.requestManager.startBatch();
      }
      /**
       * Initiates [[RequestManager.stopBatch]] in order to finalize and send the batch to the underlying transport.
       *
       * [[Client.stopBatch]] will send the [[Client.request]] calls made since the last [[Client.startBatch]] call. For
       * that reason, [[Client.startBatch]] MUST be called before [[Client.stopBatch]].
       *
       * @example
       * myClient.startBatch();
       * myClient.request({method: "foo", params: ["bar"]}).then(() => console.log('foobar'));
       * myClient.request({method: "foo", params: ["baz"]}).then(() => console.log('foobaz'));
       * myClient.stopBatch();
       */
      stopBatch() {
          return this.requestManager.stopBatch();
      }
      /**
       * A JSON-RPC call is represented by sending a Request object to a Server.
       *
       * @param requestObject.method A String containing the name of the method to be invoked. Method names that begin with the word rpc
       * followed by a period character (U+002E or ASCII 46) are reserved for rpc-internal methods and extensions and
       * MUST NOT be used for anything else.
       * @param requestObject.params A Structured value that holds the parameter values to be used during the invocation of the method.
       *
       * @example
       * myClient.request({method: "foo", params: ["bar"]}).then(() => console.log('foobar'));
       */
      request(requestObject, timeout) {
          return __awaiter(this, void 0, void 0, function* () {
              if (this.requestManager.connectPromise) {
                  yield this.requestManager.connectPromise;
              }
              return this.requestManager.request(requestObject, false, timeout);
          });
      }
      notify(requestObject) {
          return __awaiter(this, void 0, void 0, function* () {
              if (this.requestManager.connectPromise) {
                  yield this.requestManager.connectPromise;
              }
              return this.requestManager.request(requestObject, true, null);
          });
      }
      onNotification(callback) {
          this.requestManager.requestChannel.addListener("notification", callback);
      }
      onError(callback) {
          this.requestManager.requestChannel.addListener("error", callback);
      }
      /**
       * Close connection
       */
      close() {
          this.requestManager.close();
      }
  }

  exports.Client = Client;
  exports.EventEmitterTransport = EventEmitterTransport;
  exports.HTTPTransport = HTTPTransport;
  exports.JSONRPCError = JSONRPCError;
  exports.PostMessageIframeTransport = PostMessageIframeTransport;
  exports.PostMessageWindowTransport = PostMessageTransport;
  exports.RequestManager = RequestManager;
  exports.WebSocketTransport = WebSocketTransport;
  exports["default"] = Client;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
