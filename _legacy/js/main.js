document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const ui = new UI(game);
    game.init(ui);
});
