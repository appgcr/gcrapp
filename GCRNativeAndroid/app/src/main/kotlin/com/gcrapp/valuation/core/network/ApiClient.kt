package com.gcrapp.valuation.core.network

import android.content.Context
import com.gcrapp.valuation.core.security.TokenManager
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ApiClient private constructor(context: Context) {

    private val tokenManager = TokenManager.getInstance(context)

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val builder = original.newBuilder()

        tokenManager.getToken()?.let { token ->
            builder.addHeader("Authorization", "Bearer $token")
        }
        builder.addHeader("Accept", "application/json")
        builder.addHeader("User-Agent", "GCR-Native-Android/1.0")

        chain.proceed(builder.build())
    }

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .addInterceptor(loggingInterceptor)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var currentBaseUrl = tokenManager.getBaseUrl()

    private var retrofit = buildRetrofit(currentBaseUrl)

    var apiService: ApiService = retrofit.create(ApiService::class.java)
        private set

    private fun buildRetrofit(baseUrl: String): Retrofit {
        val safeUrl = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(safeUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    fun updateBaseUrl(newUrl: String) {
        if (newUrl != currentBaseUrl) {
            currentBaseUrl = newUrl
            tokenManager.setBaseUrl(newUrl)
            retrofit = buildRetrofit(newUrl)
            apiService = retrofit.create(ApiService::class.java)
        }
    }

    companion object {
        @Volatile
        private var instance: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return instance ?: synchronized(this) {
                instance ?: ApiClient(context.applicationContext).also { instance = it }
            }
        }

        fun getApiService(context: Context): ApiService {
            return getInstance(context).apiService
        }

        fun reset() {
            instance = null
        }
    }
}
