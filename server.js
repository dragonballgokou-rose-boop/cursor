const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// OpenAI API統合（オプション1: OpenAI）
async function getOpenAIResponse(message, conversationHistory = []) {
    const { Configuration, OpenAIApi } = require('openai');
    
    if (!process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEYが設定されていません');
    }

    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    const messages = [
        {
            role: 'system',
            content: 'あなたは親切で知識豊富なAIアシスタントです。日本語で丁寧に回答してください。'
        },
        ...conversationHistory.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.content
        })),
        {
            role: 'user',
            content: message
        }
    ];

    try {
        const completion = await openai.createChatCompletion({
            model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
        });

        return completion.data.choices[0].message.content;
    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);
        throw new Error('AI APIへのリクエストに失敗しました');
    }
}

// ローカルAI応答（OpenAI APIが利用できない場合のフォールバック）
function getLocalAIResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('こんにちは') || lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
        return 'こんにちは！お手伝いできることはありますか？';
    } else if (lowerMessage.includes('ありがとう') || lowerMessage.includes('thank')) {
        return 'どういたしまして！他に質問があればお気軽にどうぞ。';
    } else if (lowerMessage.includes('時間') || lowerMessage.includes('時刻')) {
        const now = new Date();
        return `現在の時刻は ${now.toLocaleString('ja-JP')} です。`;
    } else if (lowerMessage.includes('天気') || lowerMessage.includes('weather')) {
        return '申し訳ございませんが、現在天気情報の取得機能は実装されていません。';
    } else if (lowerMessage.includes('名前') || lowerMessage.includes('name') || lowerMessage.includes('誰')) {
        return '私はAI Agentです。あなたのタスクをサポートします。';
    } else if (lowerMessage.includes('機能') || lowerMessage.includes('何ができる')) {
        return '私は質問に答えたり、会話を楽しんだり、情報を提供することができます。何でもお聞きください！';
    } else {
        return `「${message}」について理解しました。より詳細な回答を得るには、OpenAI APIキーを設定してください。`;
    }
}

// チャットAPIエンドポイント
app.post('/api/chat', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ 
                error: 'メッセージが提供されていません' 
            });
        }

        let aiResponse;

        // OpenAI APIが設定されている場合は使用
        if (process.env.OPENAI_API_KEY) {
            try {
                aiResponse = await getOpenAIResponse(message, conversationHistory);
            } catch (error) {
                console.error('OpenAI API Error:', error.message);
                // フォールバック
                aiResponse = getLocalAIResponse(message);
            }
        } else {
            // ローカル応答を使用
            aiResponse = getLocalAIResponse(message);
        }

        res.json({ 
            response: aiResponse,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ 
            error: 'サーバーエラーが発生しました',
            message: error.message 
        });
    }
});

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        openaiConfigured: !!process.env.OPENAI_API_KEY,
        timestamp: new Date().toISOString()
    });
});

// ルートパスでHTMLファイルを提供
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'ai-agent.html'));
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`🚀 AI Agent Server が起動しました`);
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`🔑 OpenAI API: ${process.env.OPENAI_API_KEY ? '設定済み' : '未設定（ローカルモード）'}`);
});
