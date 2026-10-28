let lastActiveOption = document.querySelector('.option.active');

document.querySelectorAll('.option').forEach(option => {
    option.addEventListener('mouseenter', () => {
        document.querySelector('.option.active').classList.remove('active');
        option.classList.add('active');
        lastActiveOption = option;
    });
    
    option.addEventListener('mouseleave', () => {
        document.querySelectorAll('.option').forEach(opt => {
            if (opt !== lastActiveOption) {
                opt.classList.remove('active');
            }
        });
        lastActiveOption.classList.add('active');
    });
});



// Hero section text and image animation
document.addEventListener('DOMContentLoaded', () => {
    const heroContent = document.querySelector('.hero-content');
    const heroImage = document.querySelector('.hero-image');
    const leftText = document.querySelector('.left-text');
    const rightText = document.querySelector('.right-text');
    const bottomText = document.querySelector('.bottom-text');
    
    const config = {
        image: { x: 35, y: 35 },
        text: { x: 25, y: 25 },
        bottomText: { x: 15, y: 15 }
    };

    const initialPositions = {
        leftText: {
            top: '33%',
            transform: 'translateY(-50%)'
        },
        rightText: {
            top: '60%',
            transform: 'translateY(-50%)'
        },
        bottomText: {
            transform: 'translateX(-50%)'
        }
    };

    // Initial positions
    leftText.style.top = initialPositions.leftText.top;
    leftText.style.transform = initialPositions.leftText.transform;
    rightText.style.top = initialPositions.rightText.top;
    rightText.style.transform = initialPositions.rightText.transform;
    bottomText.style.transform = initialPositions.bottomText.transform;

    // Listening for mousemove on the hero section
    document.querySelector('.hero').addEventListener('mousemove', (e) => {
        const mouseX = e.clientX / window.innerWidth - 0.5;
        const mouseY = e.clientY / window.innerHeight - 0.5;

        heroImage.style.transform = `
            translate(
                ${mouseX * config.image.x}px,
                ${mouseY * config.image.y}px
            )
        `;

        // Opposite direction movement
        leftText.style.transform = `
            translateY(-50%)
            translate(
                ${mouseX * -config.text.x}px,
                ${mouseY * -config.text.y}px
            )
        `;
        rightText.style.transform = `
            translateY(-50%)
            translate(
                ${mouseX * -config.text.x}px,
                ${mouseY * -config.text.y}px
            )
        `;
        bottomText.style.transform = `
            translate(
                calc(-50% + ${mouseX * -config.bottomText.x}px),
                ${mouseY * -config.bottomText.y}px
            )
        `;
    });

    // smooth transitions with different durations
    heroImage.style.transition = 'transform 0.2s ease-out';
    leftText.style.transition = 'transform 0.2s ease-out';
    rightText.style.transition = 'transform 0.2s ease-out';
    bottomText.style.transition = 'transform 0.3s ease-out';

    // Positions when mouse leaves the hero section
    document.querySelector('.hero').addEventListener('mouseleave', () => {
        heroImage.style.transform = 'translate(0, 0)';
        leftText.style.transform = initialPositions.leftText.transform;
        rightText.style.transform = initialPositions.rightText.transform;
        bottomText.style.transform = initialPositions.bottomText.transform;
    });
});