var rask = require('rask');

var log = rask.log.get(module);

function runCmd(cmd, args, callback) {
  var spawn = require('child_process').spawn;
  var child = spawn(cmd, args);
  var out = '';
  var err = '';
  child.stdout.on('data', function(buffer) { out += buffer.toString(); });
  child.stderr.on('data', function(buffer) { err += buffer.toString(); });
  child.on('close', function(code) { callback(code, out, err); });
}

function dateFormat (date, fstr, utc) {
  utc = utc ? 'getUTC' : 'get';
  return fstr.replace (/%[YmdHMS]/g, function (m) {
    switch (m) {
      case '%Y': return date[utc + 'FullYear'] (); // no leading zeros required
      case '%m': m = 1 + date[utc + 'Month'] (); break;
      case '%d': m = date[utc + 'Date'] (); break;
      case '%H': m = date[utc + 'Hours'] (); break;
      case '%M': m = date[utc + 'Minutes'] (); break;
      case '%S': m = date[utc + 'Seconds'] (); break;
      default: return m.slice (1); // unknown code, remove %
    }
    // add leading zero if required
    return ('0' + m).slice (-2);
  });
}

var aq = rask.actionQueue.create();
var timestr = dateFormat(new Date(), '%Y-%m-%d_%H_%M_%S', false);
var rawfilepath = './raw/' + timestr + '.html';
var csvfilepath = './csv/' + timestr + '.csv';

aq.push(function() {
  var self = this;
  runCmd('./curlGet.sh', [ rawfilepath ], function(code, stdout, stderr) {
    log.info('get file =>' + rawfilepath + ' with code: ', code);
    self.next();
    if (code !== 0) {
      log.error(stderr);
      self.stop();
      return;
    }
  });
});

aq.push(function() {
  var self = this;
    var env = require('jsdom').env;
    require('fs').readFile(rawfilepath, function(err, data) {
      if (err) {
        log.error(err);
        self.stop();
        return;
      }
      var html = data.toString();
      env(html, function(errors, window) {
        var $ = require('jquery')(window);
        var $t = $('.tableListingTable');
        var results = $t.find('tr:not(.tableHeader)').map(function(i, tr) {
          return $(tr).find('td').map(function(i, td) {
            return $(td).text().replace(/[\r\n]/g, '').trim();
          }).get().join(',');
        }).get().join('\n');
        require('fs').writeFile(csvfilepath, results, function(err) {
          if (err) {
            log.error(err);
            self.stop();
            return;
          }
          self.next();
        });
      });
    });
});

aq.run({
  done: function() {
    log.info('all done');
    process.exit(0);
  },
  stop: function() {
    process.exit(1);
  }
});
