import request from "supertest"
import app from './../../app'

describe('GET /camera-ground-coverage', ()=>{

    it('should return correct result', async()=>{
        //TODO

        // example: /dev/example.jpg
        // longitude: 10.226762083333334
        // latitude: 47.561309861111106
        // altitude: 795.006
        // fovHorizontal: 73.73979529168804
        // fovVertical: 53.13010235415598
        // pitch -89.9
        // yaw 37.8

        const res = await request(app)
            .post('/camera-ground-coverage')
            .send({
                longitude: 10.226762083333334,
                latitude: 47.561309861111106,
                altitude: 795.006,
                heading: 37.8,
                pitch: -89.9,
                fovHorizontal: 73.73979529168804,
                fovVertical: 53.13010235415598
            })

        expect(res.statusCode).toEqual(200)
        expect(res.body).toEqual({
            //TODO real values
            coverage: {
                all: [],
                outer: []
            }
        })
    })

    it('should return 400 if latitude is missing', async()=>{

        const res = await request(app)
        .post('/camera-ground-coverage')
        .send({
            longitude: 10.188368
        })

        expect(res.statusCode).toEqual(400)
    })

})
