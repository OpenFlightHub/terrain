import express from 'express';
import asyncHandler from 'express-async-handler'
import Timer from '../util/timer'
import { calculateGroundCoverage } from '../util/cameraGroundCoverage'

const router = express.Router()


const GROUND_COVERAGE_RAY_PRECISION = 1.5 // rays per degree (exponential work load)


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

    const altitude = req.body.altitude

    if(isNaN(altitude)){
        res.status(400).send('invalid altitude')
        return
    }

    const heading = req.body.heading

    if(isNaN(heading)){
        res.status(400).send('invalid heading')
        return
    }


    const pitch = req.body.pitch

    if(isNaN(pitch)){
        res.status(400).send('invalid pitch')
        return
    }

    // fov see https://www.bobatkins.com/photography/technical/field_of_view.html
    const fovVertical = req.body.fovVertical

    if(isNaN(fovVertical)){
        res.status(400).send('invalid fovVertical')
        return
    }

    const fovHorizontal = req.body.fovHorizontal

    if(isNaN(fovHorizontal)){
        res.status(400).send('invalid fovHorizontal')
        return
    }

    const timer = new Timer('calculateGroundCoverage').start()

    const coverage = await calculateGroundCoverage(lon, lat, altitude, heading, pitch, fovHorizontal, fovVertical, GROUND_COVERAGE_RAY_PRECISION)

    timer.end()

    res.status(200).send({
        coverage
    })

}))

export default router
