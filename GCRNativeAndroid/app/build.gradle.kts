plugins {
  alias(libs.plugins.android.application)
  alias(libs.plugins.compose.compiler)
  alias(libs.plugins.kotlin.serialization)
}

android {
  namespace = "com.gcrapp.valuation"
  compileSdk = 36
  defaultConfig {
    applicationId = "com.gcrapp.valuation"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    create("release") {
      val keystoreFile = file("../release-keystore.jks")
        val secretFile = file("../.release_keystore.secret")
        val localSecret = if (secretFile.exists()) secretFile.readText().trim() else ""
        storeFile = keystoreFile
        storePassword = System.getenv("GCR_KEYSTORE_PASSWORD") ?: localSecret
        keyAlias = System.getenv("GCR_KEY_ALIAS") ?: (project.findProperty("GCR_KEY_ALIAS") as? String) ?: "gcr_field_engineer"
        keyPassword = System.getenv("GCR_KEY_PASSWORD") ?: localSecret
      }
    }

  buildTypes {
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.getByName("release")
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  buildFeatures {
    compose = true
    aidl = false
    buildConfig = false
    shaders = false
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }
}

kotlin {
  jvmToolchain(17)
}

dependencies {
  val composeBom = platform(libs.androidx.compose.bom)
  implementation(composeBom)
  androidTestImplementation(composeBom)

  // Core Android dependencies
  implementation(libs.androidx.core.ktx)
  implementation(libs.androidx.lifecycle.runtime.ktx)
  implementation(libs.androidx.activity.compose)

  // Arch Components
  implementation(libs.androidx.lifecycle.runtime.compose)
  implementation(libs.androidx.lifecycle.viewmodel.compose)

  // Compose
  implementation(libs.androidx.compose.ui)
  implementation(libs.androidx.compose.ui.tooling.preview)
  implementation(libs.androidx.compose.material3)
  implementation("androidx.compose.material:material-icons-extended:1.7.8")

  // Networking: Retrofit, OkHttp & Gson
  implementation("com.squareup.retrofit2:retrofit:2.11.0")
  implementation("com.squareup.retrofit2:converter-gson:2.11.0")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
  implementation("com.google.code.gson:gson:2.11.0")

  // Coroutines
  implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1")

  // Biometrics & Android Keystore Security
  implementation("androidx.fragment:fragment-ktx:1.8.6")
  implementation("androidx.biometric:biometric:1.2.0-alpha05")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")

  // CameraX
  implementation("androidx.camera:camera-core:1.4.1")
  implementation("androidx.camera:camera-camera2:1.4.1")
  implementation("androidx.camera:camera-lifecycle:1.4.1")
  implementation("androidx.camera:camera-view:1.4.1")

  // Location Services (GPS)
  implementation("com.google.android.gms:play-services-location:21.3.0")

  // WorkManager (Offline-First Sync)
  implementation("androidx.work:work-runtime-ktx:2.10.0")

  // Image Loading (Coil for Compose)
  implementation("io.coil-kt:coil-compose:2.7.0")

  // Tooling
  debugImplementation(libs.androidx.compose.ui.tooling)
  debugImplementation(libs.androidx.compose.ui.test.manifest)

  // Local tests: jUnit, coroutines, Android runner
  testImplementation(libs.junit)
  testImplementation(libs.kotlinx.coroutines.test)

  // Instrumented tests: jUnit rules and runners
  androidTestImplementation(libs.androidx.test.core)
  androidTestImplementation(libs.androidx.test.ext.junit)
  androidTestImplementation(libs.androidx.test.runner)
  androidTestImplementation(libs.androidx.test.espresso.core)

  // Navigation
  implementation(libs.androidx.navigation3.ui)
  implementation(libs.androidx.navigation3.runtime)
  implementation(libs.androidx.lifecycle.viewmodel.navigation3)
}
