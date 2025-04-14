import hgt from 'node-hgt';
import path from 'path';
import fs from 'fs'

const tilesPath = path.resolve('./terrain_tiles/')

if(!fs.existsSync(tilesPath)){
    fs.mkdirSync(tilesPath)
}

const tileset = new hgt.TileSet(tilesPath);

export function getElevation(longitude: number, latitude: number){
    return new Promise<number>((resolve, reject)=>{
        tileset.getElevation([latitude, longitude], function(err, elevation) {
            if (err) {
                reject(err)
            } else {
                resolve(elevation)
            }
        })
    })
}