//
// Copyright (C) 2013 Bob Wold
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// 
// -----------------
// [b0b]: that basically says "Go ahead and use this".
// 
// It goes without saying (but I'll say it anyway) --this is based on the original observableArray class from the good guys that gave us KnockoutJS.
//   Original Project Page: https://github.com/knockout
//   Original observableArray source: https://github.com/knockout/knockout/blob/master/src/subscribables/observableArray.js
// 
//   KnocoutJS is also released under MIT.
ko.betterObservableArray = function (initialValues) {
  initialValues = initialValues || [];

  if (typeof initialValues != 'object' || !('length' in initialValues))
    throw new Error("The argument passed when initializing an observable array must be an array, or null, or undefined.");

  var result = ko.observable(initialValues);
  ko.utils.extend(result, ko.betterObservableArray['fn']);
  return result;
};

ko.betterObservableArray['fn'] = {
  /*[b0b]:
    Helpers to let us trigger our new add/remove events more easily.*/
  'itemAdded': function (item) { this.notifySubscribers(item, "add"); },
  'itemRemoved': function (item) { this.notifySubscribers(item, "remove"); },

  'remove': function (valueOrPredicate) {
    var underlyingArray = this.peek();
    var removedValues = [];
    var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
    for (var i = 0; i < underlyingArray.length; i++) {
      var value = underlyingArray[i];
      if (predicate(value)) {
        if (removedValues.length === 0) {
          this.valueWillMutate();
        }
        removedValues.push(value);
        underlyingArray.splice(i, 1);
        i--;

        /*[b0b]*/
        this.itemRemoved(value);
      }
    }
    if (removedValues.length) {
      this.valueHasMutated();
    }
    return removedValues;
  },

  'removeAll': function (arrayOfValues) {
    // If you passed zero args, we remove everything
    if (arrayOfValues === undefined) {
      var underlyingArray = this.peek();
      var allValues = underlyingArray.slice(0);
      this.valueWillMutate();
      underlyingArray.splice(0, underlyingArray.length);

      /*[b0b]*/
      for (var i in underlyingArray) { this.itemRemoved(underlyingArray[i]); }

      this.valueHasMutated();
      return allValues;
    }
    // If you passed an arg, we interpret it as an array of entries to remove
    if (!arrayOfValues)
      return [];
    return this['remove'](function (value) {
      return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
    });
  },

  'destroy': function (valueOrPredicate) {
    var underlyingArray = this.peek();
    var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
    this.valueWillMutate();
    for (var i = underlyingArray.length - 1; i >= 0; i--) {
      var value = underlyingArray[i];
      if (predicate(value))
        underlyingArray[i]["_destroy"] = true;

      /*[b0b]: TODO: research _destroy.  I'm not totally sure about this one.*/
      this.itemRemoved(underlyingArray[i]);
    }
    this.valueHasMutated();
  },

  'destroyAll': function (arrayOfValues) {
    // If you passed zero args, we destroy everything
    if (arrayOfValues === undefined)
      return this['destroy'](function () { return true });

    // If you passed an arg, we interpret it as an array of entries to destroy
    if (!arrayOfValues)
      return [];
    return this['destroy'](function (value) {
      return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
    });
  },

  'indexOf': function (item) {
    var underlyingArray = this();
    return ko.utils.arrayIndexOf(underlyingArray, item);
  },

  'replace': function (oldItem, newItem) {
    var index = this['indexOf'](oldItem);
    if (index >= 0) {
      this.valueWillMutate();
      this.peek()[index] = newItem;

      /*[b0b]: 
        TODO: can oldItem be a function?  If so, we need to return the actual value, but if 
        not, this is a nice easy way to notify.
      */
      this.itemRemoved(oldItem);
      this.itemAdded(newItem);

      this.valueHasMutated();
    }
  },
  
  /*[b0b]
    Splice is tricky... splice can add/remove/both.  
  */
  'splice': function () {
    var underlyingArray = this.peek();
    this.valueWillMutate();

    var methodCallResult = underlyingArray["splice"].apply(underlyingArray, arguments);
    
    /*[b0b]
      The first two paramters of splice are the startindex, and the number of items to remove,
      every after that was an item to add.
      ...would love to use slice to make this clean, but arguments is not a real array in all browsers :-/
          var itemsAdded = arguments.slice(2, arguments.length);
    */
    for (var i = 2; i < arguments.length; i++) this.itemAdded(arguments[i]);

    /*[b0b] the items returned from splice are the items that were removed */
    var itemsRemoved = methodCallResult;
    for (var i in methodCallResult) this.itemRemoved(itemsRemoved[i]);

    this.valueHasMutated();

    return methodCallResult;
  },

};

/*[b0b]
  Both push and unshift add a series of items to an array (they just add them to different places), 
  but in terms of change tracking, they have the same logic for us: call add for each item, then 
  notify that the collection has mutated.
*/
ko.utils.arrayForEach(["push", "unshift"], function(methodName) {
    
  ko.betterObservableArray['fn'][methodName] = function () {
    var underlyingArray = this.peek();
    this.valueWillMutate();

    var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);

    for (var i in arguments) this.itemAdded(arguments[i]);

    this.valueHasMutated();

    return methodCallResult;
  }
});

/*[b0b]
  Both pop and shift remove an item from the list (they just remove them from different places), 
  but in terms of change tracking, they have the same logic for us: call remove for the individual
  item that was removed, then notify that the collection has mutated.
*/
ko.utils.arrayForEach(["pop", "shift"], function(methodName) {
    
  ko.betterObservableArray['fn'][methodName] = function () {
    var underlyingArray = this.peek();
    this.valueWillMutate();

    var methodCallResult = underlyingArray[methodName].apply(underlyingArray);

    this.itemRemoved(methodCallResult);

    this.valueHasMutated();

    return methodCallResult;
  }
});

/*[b0b]
  The rest of these methods will change the collection, but they don't add or remove an individual item.
*/
// Populate ko.observableArray.fn with read/write functions from native arrays
// Important: Do not add any additional functions here that may reasonably be used to *read* data from the array
// because we'll eval them without causing subscriptions, so ko.computed output could end up getting stale
ko.utils.arrayForEach(["reverse", "sort"], function (methodName) {
  ko.betterObservableArray['fn'][methodName] = function () {
    // Use "peek" to avoid creating a subscription in any computed that we're executing in the context of
    // (for consistency with mutating regular observables)
    var underlyingArray = this.peek();
    this.valueWillMutate();
    var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);
    this.valueHasMutated();
    return methodCallResult;
  };
});

// Populate ko.observableArray.fn with read-only functions from native arrays
ko.utils.arrayForEach(["slice"], function (methodName) {
  ko.betterObservableArray['fn'][methodName] = function () {
    var underlyingArray = this();
    return underlyingArray[methodName].apply(underlyingArray, arguments);
  };
});

//ko.exportSymbol('betterObservableArray', ko.betterObservableArray);