use serde::{Deserialize, Serialize};
use serde_json::{self, Error as SerdeJsonError};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GreetRequest {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GreetResponse {
    pub message: String,
}

// New message types can be added as needed
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnotherMessage {
    pub info: String,
}

// Enum to wrap all message types
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", content = "data")] // Optional: Use tags to differentiate types in JSON
pub enum AgentMessage {
    GreetRequest(GreetRequest),
    GreetResponse(GreetResponse),
    AnotherMessage(AnotherMessage),
}

impl AgentMessage {
    /// Convert to binary JSON (`Vec<u8>`)
    pub fn to_binary(&self) -> Result<Vec<u8>, SerdeJsonError> {
        serde_json::to_vec(self)
    }

    /// Create from binary JSON (`Vec<u8>`)
    pub fn from_binary(data: &[u8]) -> Result<Self, SerdeJsonError> {
        serde_json::from_slice(data)
    }
}
