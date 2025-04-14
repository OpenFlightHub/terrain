
import express from 'express'

const app = express()

export default app //for testing

//req.body will be an object if content-type header is set to application/json
app.use(express.json({limit: '100mb'}))

app.disable('x-powered-by')


// prevent query parameter pollution
import hpp from 'hpp'
app.use(hpp())

import morgan from 'morgan'
const IS_TEST_ENVIRONMENT = process.env.JEST_WORKER_ID !== undefined
if(!IS_TEST_ENVIRONMENT){
    app.use(morgan('combined'))
}

import elevationRoute from './routes/elevation'
app.use('/elevation', elevationRoute)


// 404 handler at almost the end of the use() chain
app.use((req, res, next)=> {
    res.status(404)
    res.send('404 not found: ' + req.url)
})

// error handler at the very end of the use() chain
app.use((err, req: express.Request, res: express.Response, next)=> {
    console.warn('Unhandled ' + err.name , '@url', req.method, req.baseUrl + req.url, err)
    res.status(500).send('Something went wrong')
})
