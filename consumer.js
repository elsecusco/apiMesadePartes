const amqplib = require('amqplib/callback_api')
const { accesoDatos }  = require('sielse-acceso-datos')
const sql = require('mssql')
require('dotenv').config({ path: require('find-config')('.env') })
const AWS = require("aws-sdk")
const fs = require('fs')

const contextoId = 41

AWS.config.region = process.env.AWS_REGION 
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: process.env.AWS_COGNITO 
})


let RABBIT_HOST = process.env.RABBIT_HOST
let RABBIT_QUEUE = process.env.RABBIT_QUEUE

var s3 = new AWS.S3({
    apiVersion: "2006-03-01",
    params: { Bucket: process.env.AWS_BUCKET}
})

const loginUsuario = 'MesaDePartesVirtual'



amqplib.connect(RABBIT_HOST, (err, connection) => {
    if (err) {
        console.error(err.stack);
        return process.exit(1);
    }
    connection.createChannel((err, channel) => {
        if (err) {
            console.error(err.stack);
            return process.exit(1);
        }
        console.log("CONEXION RABBIT READY")
        channel.assertQueue(RABBIT_QUEUE, {
            durable: true
        }, err => {
            if (err) {
                console.error(err.stack);
                return process.exit(1);
            }
            channel.prefetch(1);
            channel.consume(RABBIT_QUEUE, data => {
                if (data === null) {
                    return;
                }
                console.log(new Date(),'=>',data.content.toString())
                let  message= JSON.parse(data.content.toString())
                s3.getObject({
                    Bucket: message.bucket,
                    Key: message.key
                }, async (err, dataAws) => {
                    if (err){
                        console.log(err)
                        fs.appendFileSync('./log/rabbit.txt', data.content.toString() + '\n');
                        channel.ack(data);
                    }else{
                        try {
                            let bd = new accesoDatos(contextoId)
                            let parametros = [
                                { nombre: 'CodigoDocumentoTramite',tipo : sql.Int, valor : message.codigoTramite },
                                { nombre: 'CodigoDocumentoAdjunto',tipo : sql.Int, valor : message.codigoDocumento },
                                { nombre: 'NombreArchivo',tipo : sql.VarChar(200), valor : message.nombre },
                                { nombre: 'Archivo',tipo : sql.VarBinary, valor : dataAws.Body },
                                {nombre: 'LoginUsuario',tipo : sql.VarChar(20), valor : loginUsuario}
                            ]
                            let datos = await bd.ejecutarProcedimiento('taArchivoAdjuntoGuardarSWV2', parametros)
                            if(datos.intIdRetorno == 0){
                                channel.ack(data)
                            }else{
                                /*fs.appendFileSync('./log/rabbit.txt', data.content.toString() + '\n')*/
								/*CONECTARME CON RABBIT*/
								amqplib.connect(RABBIT_HOST, (connError, connection) => {
									if (connError) {
										throw connError;
									}
									// Step 2: Create Channel
									connection.createChannel((channelError, channel) => {
										if (channelError) {
											throw channelError;
										}
										// Step 3: Assert Queue
										channel.assertQueue(RABBIT_QUEUE);
										// Step 4: Send message to queue
										channel.sendToQueue(RABBIT_QUEUE, Buffer.from(JSON.stringify(message)),
												{
													persistent: true,
													contentType: 'application/json'
												}
											)
									})
								})
                                channel.ack(data);
                            }
                        } catch (error) {
                            console.log(error)
                            /*fs.appendFileSync('./log/rabbit.txt', data.content.toString() + '\n')*/
							/*CONECTARME CON RABBIT*/
								amqplib.connect(RABBIT_HOST, (connError, connection) => {
									if (connError) {
										throw connError;
									}
									// Step 2: Create Channel
									connection.createChannel((channelError, channel) => {
										if (channelError) {
											throw channelError;
										}
										// Step 3: Assert Queue
										channel.assertQueue(RABBIT_QUEUE);
										// Step 4: Send message to queue
										channel.sendToQueue(RABBIT_QUEUE, Buffer.from(JSON.stringify(message)),
												{
													persistent: true,
													contentType: 'application/json'
												}
											)
									})
								})
                            channel.ack(data);
                        }
                    }
                })
            });
        });
    });
});