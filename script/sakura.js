document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('magneticButton');
    if (!button) {
        console.error("Button not found");
        return;
    }

    const buttonRadius = 90;
    const magnetRange = 160;
    const text = button.querySelector('span');

    document.addEventListener('mousemove', (e) => {
        const buttonRect = button.getBoundingClientRect();
        const buttonCenterX = buttonRect.left + buttonRadius;
        const buttonCenterY = buttonRect.top + buttonRadius;

        const distanceX = e.clientX - buttonCenterX;
        const distanceY = e.clientY - buttonCenterY;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

        if (distance < magnetRange) {
            const force = Math.min((magnetRange - distance) / magnetRange, 1);
            const moveX = distanceX * force;
            const moveY = distanceY * force;

            // Move the button
            button.style.transform = `translate(${moveX}px, ${moveY}px)`;
            const textMoveX = moveX * 0.3;
            const textMoveY = moveY * 0.3;
            text.style.transform = `translate(${textMoveX}px, ${textMoveY}px)`;
        } else {
            button.style.transform = 'translate(0, 0)';
            if (text) {
                text.style.transform = 'translate(0, 0)';
            }
        }
    });
});