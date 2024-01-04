require('dotenv').config();
const express = require('express')
var cors = require('cors');
const app = express()
const bodyParser = require('body-parser')
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./src/swagger/swagger.json');

try {
    if (process.env.NODE_ENV === 'development'){
        app.use(cors());
    }else{
        app.use(cors({
            origin: (origin, callback) => {
                if (process.env.WHITE_LIST.indexOf(origin) !== -1) {
                    callback(null, true)
                } else {
                    callback(new Error('Key not found'))
                }
            }
        }));
    }
} catch (error) {
    console.log(error)
}




app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(bodyParser.json())

const controlador = require('./src/controlador/http')
app.use('/api',controlador)

app.listen(process.env.PORT_HTTP, process.env.HOST_HTTP)
console.log(process.env.NODE_ENV ,' => ',"Microservicio HTTP - Mesa Partes Virual  HOST:", process.env.HOST_HTTP ," PORT:", process.env.PORT_HTTP)
console.log("ACCESO DATOS => ", process.env.BD_SERVER,':',  process.env.BD_DATABASE)