package com.gcrapp.valuation.ui.chat

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gcrapp.valuation.data.models.ChatMessageDto
import com.gcrapp.valuation.data.repositories.ChatRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

data class ChatUiState(
    val messages: List<ChatMessageDto> = emptyList(),
    val isLoading: Boolean = false,
    val isSending: Boolean = false,
    val currentInput: String = ""
)

class ChatViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ChatRepository(application)
    private val timeFormat = SimpleDateFormat("hh:mm a", Locale.US)

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    init {
        loadMessages()
        startPolling()
    }

    fun onInputChanged(text: String) {
        _uiState.update { it.copy(currentInput = text) }
    }

    fun loadMessages() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }
            val result = repository.getMessages()
            result.onSuccess { msgList ->
                _uiState.update { it.copy(messages = msgList, isLoading = false) }
            }.onFailure {
                _uiState.update { it.copy(isLoading = false) }
            }
        }
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (true) {
                delay(4000)
                val result = repository.getMessages()
                result.onSuccess { msgList ->
                    if (msgList.size != _uiState.value.messages.size) {
                        _uiState.update { it.copy(messages = msgList) }
                    }
                }
            }
        }
    }

    fun sendMessage() {
        val text = _uiState.value.currentInput.trim()
        if (text.isBlank()) return

        val newMsg = ChatMessageDto(
            senderId = "engineer",
            receiverId = "ADMIN",
            text = text,
            timestamp = timeFormat.format(Date())
        )

        // Optimistic UI update
        _uiState.update { state ->
            state.copy(
                messages = state.messages + newMsg,
                currentInput = "",
                isSending = true
            )
        }

        viewModelScope.launch {
            repository.sendMessage(newMsg)
            _uiState.update { it.copy(isSending = false) }
        }
    }

    fun sendQuickResponse(quickText: String) {
        val newMsg = ChatMessageDto(
            senderId = "engineer",
            receiverId = "ADMIN",
            text = quickText,
            timestamp = timeFormat.format(Date())
        )

        _uiState.update { state ->
            state.copy(messages = state.messages + newMsg, isSending = true)
        }

        viewModelScope.launch {
            repository.sendMessage(newMsg)
            _uiState.update { it.copy(isSending = false) }
        }
    }
}
