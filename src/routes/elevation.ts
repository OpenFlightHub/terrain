import express, { Request } from 'express';
import asyncHandler from 'express-async-handler'
import { getElevation } from '../util/hgt'

const router = express.Router()

router.post('/', asyncHandler(async (req, res) => {

    const lon = req.body.longitude

    if(isNaN(lon)){
        res.status(400).send('invalid longitude')
        return
    }

    const lat = req.body.latitude

    if(isNaN(lat)){
        res.status(400).send('invalid latitude')
        return
    }

    const elevation = await getElevation(lon, lat)

    res.status(200).send({
        elevation
    })

}))

export default router
