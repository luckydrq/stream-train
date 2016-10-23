'use strict';

const EventEmitter = require('events');
const Readable = require('readable-stream');
const Duplex = require('readable-stream').Duplex;
const assert = require('assert');

class Train extends EventEmitter {
  constructor(options) {
    super();

    options = options || {};
    this._streams = [];
    this._seed = options.seed;
    this._enterIf = false;
    this._ifOK = undefined;
  }

  get length() {
    return this._streams.length;
  }

  if(condition) {
    if (this._enterIf) {
      throw new Error('.if cannot be nested');
    }

    this._enterIf = true;
    this._ifOK = !!condition;
    return this;
  }

  endif() {
    this._enterIf = false;
    this._ifOK = undefined;
    return this;
  }

  push(stream) {
    assert(stream.readable, 'stream passed in should be readable!');
    if (this._enterIf) {
      if (this._ifOK) {
        this._streams.push(stream);
      }
    } else {
      this._streams.push(stream);
    }
    return this;
  }

  unshift(stream) {
    assert(stream.readable, 'stream passed in should be readable!');
    this._streams.unshift(stream);
    return this;
  }

  delete(stream) {
    const index = this._streams.indexOf(stream);
    if (index > 0) {
      stream.removeAllListeners();
      this._streams.splice(index, 1);
    }
    return this;
  }

  validate() {
    // make sure all the streams are in objectMode
    for (const stream of this._streams) {
      const readableState = stream._readableState;
      const writableState = stream._writableState;
      if (readableState) {
        assert(readableState.objectMode, 'readable state is not objectMode!');
      }
      if (writableState) {
        assert(writableState.objectMode, 'writable state is not objectMode!');
      }
    }
  }

  run(callback) {
    if (this._enterIf) {
      // forgot to invoke .endif(), throw error
      const err = new Error('should call .endif() explicitly');
      callback && callback(err);
      return Promise.reject(err);
    }

    if (!this.length) {
      callback && callback();
      return Promise.resolve();
    }

    if (this.length === 1) {
      const ds = new Duplex({
        objectMode: true,
        read() {},
        write(chunk, enc, cb) {
          cb();
        },
      });
      this.push(ds);
    }

    if (this._seed) {
      const rs = new Readable({ objectMode: true });
      rs.push(this._seed);
      rs.push(null);
      this.unshift(rs);
    }

    try {
      this.validate();
    } catch (e) {
      return Promise.reject(e);
    }

    return new Promise(resolve => {
      let next;
      for (const stream of this._streams) {
        // delegate `error`, `info` event to train instance
        stream
          .on('pipe', () => {
            // remove .unpipe() logic from official implementation
            // If the target stream emits an error, the source stream will disconnect from it (ie, .unpipe() itself from the target stream).
            // https://github.com/nodejs/readable-stream/blob/master/lib/_stream_readable.js#L69
            const errorEvents = stream._events.error;
            if (Array.isArray(errorEvents)) {
              if (errorEvents[0].name === 'onerror') {
                errorEvents.shift();
              }
            } else if (errorEvents.name === 'onerror') {
              stream._events.error = [];
            }
          })
          .on('error', e => this.emit('error', e))
          .on('info', function() {
            // No binding of arguments for arrow functions
            const args = [].slice.call(arguments);
            this.emit.apply(this, [ 'info' ].concat(args));
          }.bind(this));

        if (!next) {
          next = stream;
        } else {
          next = next.pipe(stream);
        }
      }

      // delegate `finish` event of the last stream instance
      next.on('finish', () => {
        this.emit('finish');
        callback && callback();
        resolve();
      });
    });
  }
}

module.exports = Train;
