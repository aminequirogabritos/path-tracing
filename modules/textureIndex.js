const TextureIndex = (() => {
    let textureIndex = 0;

    const getNextTextureIndex = () => {
        console.log("🚀 ~ getNextTextureIndex ~ textureIndex:", textureIndex)
        return textureIndex++;
    }

    const getTextureIndex = () => {
        return textureIndex;
    }
    
    
    const setTextureIndex = (newIndex) => {
        textureIndex = newIndex;
    }

    return {
        getNextTextureIndex,
        getTextureIndex,
        setTextureIndex,
    }
})();

export default TextureIndex;