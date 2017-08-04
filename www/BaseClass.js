var VARS_FIELD = typeof Symbol === 'undefined' ? '__vars' + Date.now() : Symbol.for('vars');
var SUBSCRIPTIONS_FIELD = typeof Symbol === 'undefined' ? '__subs' + Date.now() : Symbol.for('subscriptions');

function BaseClass() {
  this[VARS_FIELD] = {};
  this[SUBSCRIPTIONS_FIELD] = {};
  this.errorHandler = this.errorHandler.bind(this);

  Object.defineProperty(this, 'hashCode', { value: Math.floor(Date.now() * Math.random()) })
}

BaseClass.prototype = {
  empty: function() {
    var vars = this[VARS_FIELD];

    Object.keys(vars).forEach(function(name) {
      vars[name] = null;
    });
  },

  get: function(key) {
    return this[VARS_FIELD].hasOwnProperty(key) ? this[VARS_FIELD][key] : null;
  },

  set: function(key, value, noNotify) {
    var prev = this.get(key);

    this[VARS_FIELD][key] = value;

    if (!noNotify && prev !== value) {
      this.trigger(key + '_changed', prev, value);
    }

    return this;
  },

  bindTo: function(key, target, targetKey, noNotify) {
    console.warn('[GoogleMaps] bindTo is deprecated. Please use `sync(key, target, { targetKey, silent })` instead');

    return this.sync(key, target, { targetKey: targetKey, silent: noNotify });
  },

  sync: function(key, target, options) {
    options = options || {};
    var targetKey = options.targetKey || key;
    var isSilent = options.silent;

    this.on(key + '_changed', function(oldValue, value) {
      target.set(targetKey, value, isSilent);
    });
  },

  trigger: function(eventName) {
    if (!eventName || !this[SUBSCRIPTIONS_FIELD][eventName]) {
      return this;
    }

    var listeners = this[SUBSCRIPTIONS_FIELD][eventName];
    var i = listeners.length;
    var args = Array.prototype.slice.call(arguments, 1);

    while (i--) {
      listeners[i].apply(this, args);
    }

    return this;
  },

  on: function(eventName, listener) {
    this[SUBSCRIPTIONS_FIELD][eventName] = this[SUBSCRIPTIONS_FIELD][eventName] || [];
    var topic = this[SUBSCRIPTIONS_FIELD][eventName];
    var index = topic.push(listener);
    var self = this;

    return function() {
      var topic = self[SUBSCRIPTIONS_FIELD][eventName];

      if (!topic) {
        return;
      }

      var index = topic.indexOf(listener);

      if (index !== -1) {
        topic.splice(index, 1);
      }
    };
  },

  off: function(eventName, listener) {
    if (!eventName && !listener) {
      this[SUBSCRIPTIONS_FIELD] = {};
    } else if (eventName && !listener) {
      this[SUBSCRIPTIONS_FIELD][eventName] = null;
    } else if (this[SUBSCRIPTIONS_FIELD][eventName]) {
      var index = this[SUBSCRIPTIONS_FIELD][eventName].indexOf(listener);

      if (index !== -1) {
        this[SUBSCRIPTIONS_FIELD][eventName].splice(index, 1);
      }
    }

    return this;
  }

  one: function(eventName, listener) {
    var unlisten = this.on(eventName, function() {
      unlisten();
      listener.apply(this, arguments);
    });

    return this;
  },

  destroy: function() {
    this.off();
    this.empty();
  },

  errorHandler: function(error) {
    if (error) {
      console.log(error);
      this.trigger('error', error instanceof Error ? error : createError(error));
    }

    return false;
  }
};

function createError(message, methodName, args) {
  var error = new Error(methodName ? [
    'Got error with message: "', message, '" ',
    'after calling "', methodName, '"'
  ].join('') : message);

  Object.defineProperties(error, {
    methodName: { value: methodName },
    args: { value: args }
  });

  return error;
}

module.exports = BaseClass;
