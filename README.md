# stream-train

[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url]

Make stream pipeline a little easier to use(objectMode only).

## Advantages

### Forward errors in pipeline which won't happen in normal cases

Consider the following code snippet:

```js
stream1
  .pipe(stream2)
  .pipe(stream3)
  .on('error', e => console.error(e));
```

This is a normal case of using stream pipelines. You would only catch the error emitted by `stream3`, because errors **do not forward** in node official stream implementation. This pkg makes a little effort and forward all the errors for you.

```js
new Train()
  .push(stream1)
  .push(stream2)
  .on('error', e => {
    // all errors emitted by stream1, stream2, stream3 would come here
    console.error(e);
  })
  .run();
```

### Won't break pipeline when error occurs

Once an error occurs, upstream will invoke [.unpipe() method](https://github.com/nodejs/readable-stream/blob/master/lib/_stream_readable.js#L563) which results in disconnect between upstream and downstream meaning that the pipeline would break. But in real world, we use streams with `{ objectMode: true }` to process object that is completely isolate from the others. If one failed, we just do some logs and expect the pipeline to go on. This pkg will do the trick for you.

```js
new Train()
  .push(through2.obj(function(chunk, enc, cb) {
    this.emit('error', new Error('oops!'));
    this.push('haha');
    cb();
  }))
  .push(through2.obj(function(chunk, enc, cb) {
    console.log(chunk); // haha
    cb();
  }))
  .on('error', e => {
    console.error(e.message);  // oops!
  })
  .run();
```

## Installation

```bash
$ npm i stream-train --save
```

## API

### constructor(options)
- options.seed: Original object you want to pass down to the stream pipeline, optional.

```js
const file = { path: '/Users/foo/a.js' };
new Train({ seed: file })
  .push(through2.obj(function(file, enc, cb) {
    console.log(file.path);  // /Users/foo/a.js
  }))
  .push(stream2)
  .run();
```

**Notice: Seed is optional, think of what you want to do. If you use a stream that can read by itself(such as [vfs.src](https://github.com/gulpjs/vinyl-fs)), then there is no need to set seed.**

### .push(stream)
Append a stream instance to internal list, it's chainable.

### .unshift(stream)
Prepend a stream instance to internal list, it's chainable.

### .delete(stream)
Delete a stream instance from internal list, it's chainable.

### .run(callback)
Start the pipeline, accept optional argument `callback` which is invoked when pipeline finish. Return a Promise.

## Events

### error
Emitted when any stream in the pipeline emit `error` event.

### info
Emitted when any stream in the pipeline emit `info` event.

## LICENSE
MIT

[downloads-image]: http://img.shields.io/npm/dm/stream-train.svg
[npm-url]: https://www.npmjs.com/package/stream-train
[npm-image]: https://badge.fury.io/js/stream-train.svg

[travis-url]: https://travis-ci.org/luckydrq/stream-train
[travis-image]: https://travis-ci.org/luckydrq/stream-train.svg?branch=master
