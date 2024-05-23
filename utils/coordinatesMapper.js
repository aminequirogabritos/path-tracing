//import * as THREE from 'three';

// Helper function to map 
export function mapCoordinates(coordinatesArray, coordinatesIndexesArray) {
    // console.log("🌸 ~ mapCoordinates ~ coordinatesIndexesArray:", coordinatesIndexesArray)
    // console.log("🌸 ~ mapCoordinates ~ Math max coordinatesIndexesArray:", Math.max(...coordinatesIndexesArray))
    
    let mappedArray = [];

    coordinatesIndexesArray.forEach(index => {
        mappedArray.push(...[coordinatesArray[index], coordinatesArray[index+1], coordinatesArray[index+2]]);
    });

    return mappedArray;
}

