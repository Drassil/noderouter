const EventEmitter = require('events');

const eventType = (type) => Symbol(type);

const Events = {
  OnHTTPSNoClientFound: eventType('OnHTTPSNoClientFound'),
};

/**
 * EventManager for node-platform, you can extend it to create your own EventManager
 *
 */
class EventManager extends EventEmitter {
  constructor(events, name = 'node-platform') {
    super();

    this.events = events;
    this.name = name;
    Object.freeze(this.name); // avoid changing EventManager name
  }

  eventAssert(event) {
    const evtName = event.toString().slice(7, -1); // remove "Symbol()" from description
    if (!this.events[evtName] || this.events[evtName] != event) {
      throw new Error(
          'EventManager (' + this.name + ') have no event: ' + evtName,
      );
    }
  }

  /**
   *
   * @param {symbol} event - Symbol of the event to emit
   * @param  {...any} args - list of arguments to pass to the event separated by comma
   * @returns {boolean} - Return a promise that the event will be completed
   */
  emit(event, ...args) {
    this.eventAssert(event);

    return super.emit(event, ...args);
  }

  /**
      @callback listenerCb
      @param {...Object} args
   */
  /**
   *
   * @param {symbol} event - Symbol of the event to register on
   * @param {listenerCb} listener - Callback function that will be called when the emit will be emitted
   * @returns {EventManager} - Returns the EventManager instance to eventually continue with the chain
   */
  // @ts-ignore
  on(event, listener) {
    this.eventAssert(event);

    return super.on(event, listener);
  }

  /**
   *
   * @param {symbol} event - Symbol of the event to register once
   * @param {listenerCb} listener - Callback function that will be called when the emit will be emitted
   * @returns {EventManager} - Returns the EventManager instance to eventually continue with the chain
   */
  // @ts-ignore
  once(event, listener) {
    this.eventAssert(event);

    return super.once(event, listener);
  }
}

module.exports = {
  Events,
  eventType,
  EventManager,
};
