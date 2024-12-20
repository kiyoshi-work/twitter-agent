import net from 'net';

export class Client {
  private readonly host: string;
  private readonly port: number;
  private socket: net.Socket | null = null;

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.connect(this.port, this.host, () => {
        resolve();
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  public close(): void {
    if (this.socket) {
      this.socket.end();
      this.socket.destroy();
      this.socket = null;
    }
  }

  public async send(command: string): Promise<string> {
    if (!this.socket) {
      throw new Error('Socket is not connected. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      const requestData = this.serializeRequest(command);
      let responseData = '';

      this.socket?.write(requestData, 'utf8', (err) => {
        if (err) {
          reject(err);
        }
      });

      this.socket?.on('data', (chunk) => {
        responseData += chunk.toString('utf8');
        if (this.isCompleteResponse(responseData)) {
          this.socket?.removeAllListeners('data');
          resolve(this.deserializeResponse(responseData));
        }
      });

      this.socket?.on('error', (err) => {
        reject(err);
      });
    });
  }

  private serializeRequest(command: string): string {
    // Custom serialization logic if needed
    return command + '\r\n';
  }

  private deserializeResponse(response: string): string {
    // Custom deserialization logic if needed
    return response;
  }

  private isCompleteResponse(response: string): boolean {
    // Implement a way to determine if the response is complete
    // For simplicity, we assume the response ends with a newline character
    return response.endsWith('\r\n');
  }
}

async function runExample() {
  const client = new Client('127.0.0.1', 6379); // Replace with your Redis server IP and port

  try {
    // Connect to the Redis server
    console.log('Connecting to Redis...');
    await client.connect();
    console.log('Connected.');

    // Send a SET command
    console.log('Setting a key...');
    const setResponse = await client.send('SET mykey "Hello, Redis!"');
    console.log('SET Response:', setResponse); // Should return "+OK"

    // Send a GET command
    console.log('Getting the key...');
    const getResponse = await client.send('GET mykey');
    console.log('GET Response:', getResponse); // Should return the value: "Hello, Redis!"
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Close the connection
    console.log('Closing connection...');
    client.close();
    console.log('Connection closed.');
  }
}

runExample();
