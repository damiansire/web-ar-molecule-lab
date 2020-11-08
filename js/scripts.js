//Esto es el hecho de aplicar a mi video el modelo de deteccion
let handpose;
//En esta variable video va mi video
let video;
//En este array, van los puntos de mi mano (Los que detecto/predigo)
let predictions = [];

let figureName;

let figureSize = 200;

document.querySelector("#figureSize").addEventListener("input", (event) => {
    figureSize = int(event.data);
})

function drawFigureFunction(figureName) {
    switch (figureName) {
        case "Cuadrado":
            plane(70);
            break;
        case "Cubo":
            box(70, 70, 70);
            break;
        case "Cilindro":
            cylinder(70, 70);
            break;
        case "Cono":
            cone(70, 70);
            break;
        case "Toro":
            torus(70, 20);
            break;
        case "Esfera":
            sphere(70);
            break;
    }
}


//Setup, es de processing, se inicia una sola vez
function setup() {
    //Creo el lienzo/rectangulo donde voy a dibujar
    createCanvas(640, 480, WEBGL);
    //Capturo en tiempo real mi webcam
    video = createCapture(VIDEO);
    //Elijo el tamaño de mi video/webcam a mostrar
    video.size(width, height);
    //Le aplico a mi video, el modelo de inteligencia artificial que detecta mi mano
    handpose = ml5.handpose(video);

    // Escucho a mi video y modelo, y cuando hay una nueva prediccion
    // Actualizo los puntos del array (Mi mano)
    handpose.on("predict", results => {
        predictions = results;
    });

    // Oculto el video
    video.hide();

    figureName = "Cubo";

    document.querySelectorAll(".figureButton").forEach(button =>
        button.addEventListener("click", (event) => {
            figureName = event.target.getAttribute("data-id");
        }))
}


function draw() {
    //Toma mi video y lo dibuja muchas veces
    image(video, -width / 2, -height / 2, width, height);
    translate(-width / 2, -height / 2)
        // Dibuja los puntos resultantes de mi mano

    let lastPrediction = getLastPrediction();
    if (lastPrediction != null) {
        drawFigure(lastPrediction[0], lastPrediction[1], figureSize)
    }
}

// Dibuja los puntos como elipse/circulo
function drawKeypoints() {
    for (i = 0; i < predictions.length; i += 1) {
        const prediction = predictions[i];
        for (let j = 0; j < prediction.landmarks.length; j += 1) {
            const keypoint = prediction.landmarks[j];
            fill(0, 255, 0);
            noStroke();
            ellipse(keypoint[0], keypoint[1], 10, 10);
        }
    }
}

function getLastPrediction() {
    if (predictions[0] && predictions[0].landmarks) {
        return predictions[0].landmarks[2];
    }
    return null;
}

function drawFigure(x, y, z) {
    translate(x, y, z);
    push();
    rotateZ(frameCount * 0.01);
    rotateX(frameCount * 0.01);
    rotateY(frameCount * 0.01);
    drawFigureFunction(figureName)
    pop();
}