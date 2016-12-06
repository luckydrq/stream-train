'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const through2 = require('through2');
const vfs = require('vinyl-fs');
const Readable = require('stream').Readable;
const Train = require('..');
const tempFile = path.join(__dirname, 'temp');
const encoding = 'utf8';

describe('test/train.test.js', () => {
  beforeEach(() => {
    fs.writeFileSync(tempFile, '', { encoding });
  });

  afterEach(() => {
    fs.unlinkSync(tempFile);
  });

  it('should run with seed', done => {
    const file = { path: tempFile };
    const train = new Train({ seed: file });
    const stream1 = through2.obj(function(file, enc, cb) {
      this.push(file);
      cb();
    });
    const stream2 = through2.obj(function(file, enc, cb) {
      assert(file.path.indexOf('temp') > -1);
      cb();
    });

    train.push(stream1)
      .push(stream2)
      .run(done);
  });

  it('should run without seed', done => {
    const train = new Train();
    const stream1 = vfs.src('test/*.js');
    const stream2 = through2.obj(function(file, enc, cb) {
      cb();
    });
    train
      .push(stream1)
      .push(stream2)
      .run(done);

  });

  it('should emit error without disconnect from upstream', done => {
    const train = new Train();
    const stream1 = new Readable({
      objectMode: true,
      read() {},
    });
    stream1.push(1);
    setTimeout(() => {
      stream1.push(2);
      setTimeout(() => stream1.push(null), 200);
    }, 200);
    const stream2 = through2.obj(function(file, enc, cb) {
      this.emit('error', new Error(`error${file}`));
      cb();
    });

    train
      .push(stream1)
      .push(stream2)
      .on('error', e => {
        assert(e.message.indexOf('error') > -1);
      })
      .run(done);
  });

  it('should emit error when through2 cb error', done => {
    const train = new Train();
    const stream1 = new Readable({
      objectMode: true,
      read() {},
    });
    stream1.push(1);

    train
      .push(stream1)
      .push(through2.obj(function(chunk, enc, cb) {
        cb(new Error('through2 error'));
      }))
      .on('error', e => {
        assert(e.message === 'through2 error');
        done();
      })
      .run();
  });

  it('should emit info', done => {
    const train = new Train();
    const stream1 = new Readable({
      objectMode: true,
      read() {},
    });
    stream1.push(1);
    setTimeout(() => {
      stream1.push(2);
      setTimeout(() => stream1.push(null), 200);
    }, 200);
    const stream2 = through2.obj(function(file, enc, cb) {
      this.emit('info', file);
      cb();
    });

    train
      .push(stream1)
      .push(stream2)
      .on('info', data => {
        assert([ 1, 2, 3 ].indexOf(data) > -1);
      })
      .run(done);
  });

  it('should run if no streams pushed', done => {
    const train = new Train();
    train.run(done);
  });

  it('should run if only one readable stream pushed', done => {
    const train = new Train();
    train
      .push(new Readable({
        objectMode: true,
        read() {
          this.push(null);
        },
      }))
      .run(done);
  });

  it('should only allow stream in objectMode', done => {
    const train = new Train();
    train
      .push(new Readable({
        read() {
          this.push(null);
        },
      }))
      .run()
      .catch(e => {
        assert(e.message.indexOf('readable state is not objectMode!') > -1);
        done();
      });
  });

  it('should support .if', done => {
    const seed = { count: 1 };
    const train = new Train({ seed });

    train
      .if(true)
        .push(through2.obj(function(chunk, enc, cb) {
          chunk.count++;
          this.push(chunk);
          cb();
        }))
      .endif()
      .push(through2.obj(function(chunk, enc, cb) {
        chunk.count++;
        cb();
      }))
      .run(() => {
        assert(seed.count === 3);
        done();
      });
  });

  it('should call .endif to close if condition', done => {
    const seed = { count: 1 };
    const train = new Train({ seed });

    train
      .if(true)
        .push(through2.obj(function(chunk, enc, cb) {
          chunk.count++;
          this.push(chunk);
          cb();
        }))
      .push(through2.obj(function(chunk, enc, cb) {
        chunk.count++;
        cb();
      }))
      .run()
      .catch(e => {
        assert(e.message.indexOf('should call .endif() explicitly') > -1);
        done();
      });
  });
});
