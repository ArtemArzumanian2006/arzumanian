function openFullScreen(event) {
    event.preventDefault();
    const fullScreenContainer = document.createElement('div');
    fullScreenContainer.style.position = 'fixed';
    fullScreenContainer.style.top = '0';
    fullScreenContainer.style.left = '0';
    fullScreenContainer.style.width = '100%';
    fullScreenContainer.style.height = '100%';
    fullScreenContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    fullScreenContainer.style.zIndex = '1000';
    fullScreenContainer.style.display = 'flex';
    fullScreenContainer.style.alignItems = 'center';
    fullScreenContainer.style.justifyContent = 'center';
    fullScreenContainer.style.cursor = 'zoom-out';

    const fullScreenImage = document.createElement('img');
    fullScreenImage.src = event.currentTarget.href;
    fullScreenImage.style.maxWidth = '60%';
    fullScreenImage.style.maxHeight = '60%';

    fullScreenContainer.appendChild(fullScreenImage);
    document.body.appendChild(fullScreenContainer);

    fullScreenContainer.onclick = () => document.body.removeChild(fullScreenContainer);
  }