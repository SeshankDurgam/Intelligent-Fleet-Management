function mapToDittoProtocolMsg(headers, textPayload, bytePayload, contentType) {
    const jsonData = JSON.parse(textPayload);
    const thingId = jsonData.thingId.split(':');
    const value = {            
            trustAgent: {
                properties: {
                    version: jsonData.version,
                    status: jsonData.status
                }
            }
        };
	return Ditto.buildDittoProtocolMsg(
        thingId[0],
        thingId[1],
        'things',
        'twin',
        'commands',
        'modify',
        '/features',
        headers,
        value
    );
}