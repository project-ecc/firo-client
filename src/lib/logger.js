import { join } from 'path'
import winston from 'winston'
import { getApp } from '#/lib/utils'

const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        //winston.format.colorize(),
        winston.format.splat(),
        winston.format.timestamp(),
        winston.format.printf(info => {
            const label = info.label ? `[${info.label}] ` : ''
            return `${info.timestamp} ${label}${info.level}: ${info.message}`
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
            filename: join(getApp().getPath('userData'), 'combined.log'),
            handleExceptions: true
        })
    ]
})

export const createLogger = function (label = 'zcoin:no-module') {
    return logger.child({ label })
}
