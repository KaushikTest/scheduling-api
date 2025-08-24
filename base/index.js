import express from 'express';
import router from '../routes/events.js';
import profileRouter from '../routes/profiles.js';
import hoursRouter from '../routes/business_hours.js';
import slotsRouter from '../routes/slots.js';

const app = express();
export const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Scheduling API with SQLite is up and running!');
});

app.use('/events', router);

app.use('/profiles', profileRouter);

app.use('/hours', hoursRouter);

app.use('/slots', slotsRouter);

if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`);
    });
}

export default app;