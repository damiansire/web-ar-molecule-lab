//Esto es el hecho de aplicar a mi video el modelo de deteccion
let handpose;
//En esta variable video va mi video
let video;
//En este array, van los puntos de mi mano (Los que detecto/predigo)
let predictions = [];

let figureName;

let figureSize = 200;

//Slider
let backgroundSliders;
let figureColorSliders;
let figureSizeSlider;
let figureRotateSlider;

//Setup, es de processing, se inicia una sola vez
function setup() {
    //Creo el lienzo/rectangulo donde voy a dibujar
    createCanvas(640, 480, WEBGL);
    //Capturo en tiempo real mi webcam
    video = createCapture(VIDEO);
    //Elijo el tamaño de mi video/webcam a mostrar
    video.size(width, height);

    function modelReady() {
        console.log('hand pose loaded');
        alert('cargado el modelo')
        handpose.on("predict", results => {
            predictions = results;
        });
      }

    //Le aplico a mi video, el modelo de inteligencia artificial que detecta mi mano
    handpose = ml5.handpose(video,modelReady);

    // Escucho a mi video y modelo, y cuando hay una nueva prediccion
    // Actualizo los puntos del array (Mi mano)


    // Oculto el video
    video.hide();

    figureName = "Cubo";

    document.querySelectorAll(".figureButton").forEach(button =>
        button.addEventListener("click", (event) => {
            figureName = event.target.getAttribute("data-id");
        }))

    //Los sliders
    let acumulateHeight = 100;
    backgroundSliders = createSlidersInProcessing(width + 30, acumulateHeight, 3, "Colores de fondo")
    acumulateHeight += getSlidersWithTextHeight(3);
    figureColorSliders = createSlidersInProcessing(width + 30, acumulateHeight, 3, "Color de la figura")
    acumulateHeight += getSlidersWithTextHeight(3);
    figureSizeSlider = createSliderInProcessing(width + 30, acumulateHeight, "Tamaño", 0, 100, 100);
    figureSizeSlider.value(100 / 2)
    acumulateHeight += getSlidersWithTextHeight(1);
    figureRotateSlider = createSliderInProcessing(width + 30, acumulateHeight, "Angular de rotacion", 0, 10, 1);
    acumulateHeight += getSlidersWithTextHeight(1);

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
    let angleRotation = figureRotateSlider.value() / 10;
    //applyBackgroundColor se activa realmente unicamente si quiere color
    applyBackgroundColor()
    translate(x, y, z);
    push();
    rotateZ(frameCount * angleRotation);
    rotateX(frameCount * angleRotation);
    rotateY(frameCount * angleRotation);
    applyBackgroundColorToFigure()
    drawFigureFunction(figureName)
    pop();
}


//Un strategy pattern medio turbio xD
function drawFigureFunction(figureName) {
    let sliderSizeValue = figureSizeSlider.value();
    switch (figureName) {
        case "None":
            break;
        case "Cuadrado":
            return plane(sliderSizeValue);
            break;
        case "Cubo":
            return box(sliderSizeValue, sliderSizeValue, sliderSizeValue);
            break;
        case "Cilindro":
            return cylinder(sliderSizeValue, sliderSizeValue);
            break;
        case "Cono":
            return cone(sliderSizeValue, sliderSizeValue);
            break;
        case "Toro":
            return torus(sliderSizeValue, 20);
            break;
        case "Esfera":
            return sphere(sliderSizeValue);
            break;
    }
}

optionsButton = ["colorButton", "backgroundButton"]

buttonState = optionsButton.map(buttonClass => { buttonClass: false });

//Agrego los detectores de click a los botoens
optionsButton.forEach(buttonClass => {
    let button = document.getElementsByClassName(buttonClass)[0];
    button.addEventListener("click", () => {
        buttonState[buttonClass] = !buttonState[buttonClass];
    })
})

function applyBackgroundColor() {
    if (buttonState["backgroundButton"]) {
        const r = backgroundSliders[0].value();
        const g = backgroundSliders[1].value();
        const b = backgroundSliders[2].value();
        background(r, g, b);
    }
}

function applyBackgroundColorToFigure() {
    if (buttonState["colorButton"]) {
        const r = figureColorSliders[0].value();
        const g = figureColorSliders[1].value();
        const b = figureColorSliders[2].value();
        fill(r, g, b);
    }
}


// Hay un bug de processing a la hora de colocar los textos con videos
// Por lo cual creo la funcion yo
// ATT EL DAMI
function setTextInProcessing(text, positionX, positionY) {
    let spanElement = document.createElement("span");
    //Si vas a cambiar algo, no cambies esto
    //Uso textNode para no regenerar el arbol
    //NO CAMBIAR POR INNER HTML o alguna variante
    let textElement = document.createTextNode(text);
    //Le agrego el texto al elemento span
    spanElement.appendChild(textElement);
    //Te devuelve una referencia al elemento html
    let spanRef = document.getElementsByTagName("body")[0].appendChild(spanElement)
    spanRef.style.position = "absolute";
    spanRef.style.left = positionX + "px";
    spanRef.style.top = positionY + "px";
    return spanRef;
}

function createSlidersInProcessing(positionX, positionY, sliderAmount, sliderText) {
    slidersRef = []
    setTextInProcessing(sliderText, positionX, positionY)
    for (let sliderIndex = 0; sliderIndex < sliderAmount; sliderIndex++) {
        let rSlider = createSlider(0, 255, 100);
        rSlider.position(positionX, positionY + 20 + 30 * sliderIndex);
        slidersRef.push(rSlider)
    }
    return slidersRef;
}

function createSliderInProcessing(positionX, positionY, sliderText, fromValue, toValue, realValue) {
    setTextInProcessing(sliderText, positionX, positionY)
    let slidersRef = createSlider(fromValue, toValue, realValue);
    slidersRef.position(positionX, positionY + 20);
    return slidersRef;
}


//Obtener cuanto ocupan x cantidad de sliders con texto (en px)
function getSlidersWithTextHeight(slidersAmount) {
    return 20 + 30 * slidersAmount;
}