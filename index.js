const ConsoleReporter = require('jasmine').ConsoleReporter,
  buildWebdriver = require('./lib/webdriver').buildWebdriver,
  util = require('util'),
  Server = require('./lib/server'),
  Runner = require('./lib/runner');

function createReporter(options) {
  if (options.reporter) {
    try {
      var Report = require(options.reporter);
      return new Report();
    } catch (e) {
      console.log(
        'failed to register reporter "' + options.reporter + '" using default'
      );
      console.log(e.message);
      console.log(e.stack);
    }
  }

  const reporter = new ConsoleReporter();
  reporter.setOptions({
    print: function() {
      process.stdout.write(util.format.apply(this, arguments));
    },
    showColors: options.color === 'undefined' ? true : options.color,
  });
  return reporter;
}

module.exports = {
  startServer: function(options, serverOptions) {
    const server = new Server(options);
    return server.start(serverOptions || {});
  },
  runSpecs: async function(options) {
    if (options.browser && options.browser.name === 'internet explorer') {
      options.jsonDomReporter = true;
    } else {
      options.batchReporter = true;
    }

    const server = new Server(options);
    const webdriver = buildWebdriver(options.browser);

    const reporter = createReporter(options);
    const useSauce = options.browser && options.browser.useSauce;
    const portRequest = useSauce ? 5555 : 0;
    await server.start({ port: portRequest });
    const host = `http://localhost:${server.port()}`;
    const runner = new Runner({ webdriver, reporter, host });

    console.log('Running tests in the browser...');
    return runner
      .run(options)
      .catch(function(err) {
        console.error(err);
      })
      .then(async function(details) {
        if (details.overallStatus === 'passed') {
          process.exitCode = 0;
        } else if (details.overallStatus === 'incomplete') {
          process.exitCode = 2;
        } else {
          process.exitCode = 1;
        }
        await server.stop();

        if (useSauce) {
          await webdriver.executeScript(
            `sauce:job-result=${process.exitCode === 0}`
          );
        }

        await webdriver.close();
        return details;
      });
  },
  Server,
  Runner,
};
