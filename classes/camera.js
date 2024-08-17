import * as THREE from 'three';

class Camera {
    constructor(fov, aspect, near, far) {

        this.threeCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);

        this.camera = this.update();

    };

    translate = (axisParameter, rotationParameter) => {
        switch (axisParameter) {
            case 'x':
            case 'X':
                this.threeCamera.position.x += rotationParameter;
                break;
            case 'y':
            case 'Y':
                this.threeCamera.position.y += rotationParameter;
                break;
            case 'z':
            case 'Z':
                this.threeCamera.position.z += rotationParameter;
                break;
            default:
                throw new Error();
        }
        this.update();
    };

    rotate = (axisParameter, rotationParameter) => {
        switch (axisParameter) {
            case 'x':
            case 'X':
                this.threeCamera.rotateX(rotationParameter);
                break;
            case 'y':
            case 'Y':
                this.threeCamera.rotateY(rotationParameter);
                break;
            case 'z':
            case 'Z':
                this.threeCamera.rotateZ(rotationParameter);
                break;
            default:
                throw new Error();
        }
        this.update();
    };

    lookAt = (xParameter, yParameter, zParameter) => {
        this.threeCamera.lookAt(xParameter, yParameter, zParameter);
        this.update();
    };

    update = () => {

        console.log('Camera.update - start');

        // console.log('camera', this.camera)

        this.camera = {};

        this.camera.cameraSource = this.threeCamera.position.clone(); // no normalizar!!!!!
        this.camera.cameraDirection = new THREE.Vector3();
        this.threeCamera.getWorldDirection(this.camera.cameraDirection)

        this.camera.cameraUp = this.threeCamera.up.clone();
        this.camera.cameraRight = new THREE.Vector3().crossVectors(this.camera.cameraDirection, this.camera.cameraUp).normalize();

        this.camera.cameraLeft = this.camera.cameraRight.clone().negate();
        // const cameraMiddle = cameraSource.clone().sub(new THREE.Vector3(0.0, cameraSource.y, 0.0));
        this.camera.cameraMiddle = this.camera.cameraSource.clone().add(this.camera.cameraDirection.clone()/* .multiplyScalar(1.2) */); // multiplicar por escalar para cambiar posicion near plano frustum
        // console.log("🚀 ~ cameraSource:", this.camera.cameraSource)


        // const cameraLeftBottom = getLeftBottomCorner(camera, planeDimensions.width, planeDimensions.height);
        this.camera.cameraLeftBottom = this.camera.cameraMiddle.clone()
            .sub(this.camera.cameraRight.clone().multiplyScalar(0.5))
            .sub(this.camera.cameraUp.clone().multiplyScalar(0.5));
        // console.log("🚀 ~ cameraLeftBottom:", this.camera.cameraLeftBottom)
        // (?) cameraLeftBottom.x += -0.5; // esta escala se hace para que el plano "near" no esté tan pegado a la cámara

        console.log('Camera.update - end');
    };
    
    getCamera() {
        return this.camera;
    };
};

export default Camera;