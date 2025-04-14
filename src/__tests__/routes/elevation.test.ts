import request from "supertest"
import app from './../../app'

describe('GET /elevation', ()=>{

    it('should return correct result', async()=>{

        const res = await request(app)
            .post('/elevation')
            .send({
                longitude: 10.188368,
                latitude: 47.525482
            })

        expect(res.statusCode).toEqual(200)
        expect(res.body).toEqual({
            elevation: 1659.904737279986
        })
    })

    it('should return 400 if latitude is missing', async()=>{

        const res = await request(app)
        .post('/elevation')
        .send({
            longitude: 10.188368
        })

        expect(res.statusCode).toEqual(400)
    })

})
