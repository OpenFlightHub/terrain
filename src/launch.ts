import app from './app'


const PORT = 6007;
const HOST = '0.0.0.0';

export const server = app.listen(PORT, HOST, () => {
    console.log(`Running on http://${HOST}:${PORT}`);
})
