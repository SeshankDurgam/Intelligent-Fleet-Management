const { format, createLogger, transports } = require("winston");

const { combine, timestamp, printf, colorize, align } = format;

//Using the printf format.
//const customFormat = printf(({ level, message, label, timestamp }) => {
//  return `${timestamp} [${label}] ${level}: ${message}`;
//});

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'debug',
    defaultMeta: {
        service: 'Ditto Fleet',
      },
    format: combine(
      colorize({ all: true }),
      timestamp({
        format: 'DD-MM-YYYY hh:mm:ss.SSS A',
      }),
      align(),
      printf((info) => `[${info.timestamp}] ${info.source} ${info.level}: ${info.message}`)
    ),
    transports: [new transports.Console()],
  });

module.exports = logger;