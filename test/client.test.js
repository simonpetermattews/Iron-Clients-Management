const { app } = require('electron');
const request = require('supertest');
const { createServer } = require('../src/main/ipc/clients');

let server;

beforeAll((done) => {
    server = createServer();
    server.listen(3000, () => {
        done();
    });
});

afterAll((done) => {
    server.close(done);
});

describe('Client Management API', () => {
    it('should create a new client', async () => {
        const response = await request(server)
            .post('/clients')
            .send({ name: 'John Doe', email: 'john@example.com' });
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
    });

    it('should retrieve all clients', async () => {
        const response = await request(server).get('/clients');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });

    it('should update a client', async () => {
        const client = await request(server)
            .post('/clients')
            .send({ name: 'Jane Doe', email: 'jane@example.com' });
        const response = await request(server)
            .put(`/clients/${client.body.id}`)
            .send({ name: 'Jane Smith' });
        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Jane Smith');
    });

    it('should delete a client', async () => {
        const client = await request(server)
            .post('/clients')
            .send({ name: 'Mark Smith', email: 'mark@example.com' });
        const response = await request(server)
            .delete(`/clients/${client.body.id}`);
        expect(response.status).toBe(204);
    });
});